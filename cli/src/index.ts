#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import crypto from 'node:crypto';
import { createContractRuntime, type BackendMode } from './contract-runtime.js';

const EARN_API = 'https://earn.li.fi';
const COMPOSER_API = 'https://li.quest';

const CHAIN_MAP: Record<string, number> = {
  ethereum: 1, eth: 1,
  arbitrum: 42161, arb: 42161,
  base: 8453,
  optimism: 10, op: 10,
  polygon: 137,
  avalanche: 43114, avax: 43114,
  bsc: 56,
};

interface Vault {
  address: string;
  name: string;
  chainId: number;
  network: string;
  protocol: { name: string };
  tags: string[];
  isTransactional: boolean;
  underlyingTokens: { symbol: string; decimals: number }[];
  analytics: {
    apy: { total: number; base: number; reward: number | null };
    tvl: { usd: string };
  };
}

interface ComposerQuote {
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
  estimate?: {
    gasCosts?: { amountUSD: string }[];
  };
}

function formatApy(apy: number | null | undefined): string {
  if (apy == null) return chalk.dim('N/A');
  if (apy >= 10) return chalk.green.bold(`${apy.toFixed(2)}%`);
  if (apy >= 3) return chalk.green(`${apy.toFixed(2)}%`);
  return chalk.yellow(`${apy.toFixed(2)}%`);
}

function formatTvl(usd: string | undefined): string {
  if (!usd) return chalk.dim('N/A');
  const n = Number(usd);
  if (n >= 1e9) return chalk.cyan(`$${(n / 1e9).toFixed(2)}B`);
  if (n >= 1e6) return chalk.cyan(`$${(n / 1e6).toFixed(2)}M`);
  if (n >= 1e3) return chalk.cyan(`$${(n / 1e3).toFixed(0)}K`);
  return chalk.cyan(`$${n.toFixed(0)}`);
}

function parseTokenAmount(amount: string, decimals: number): string {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const whole = wholePart === '' ? '0' : wholePart;
  const fractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fractional || '0')).toString();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(chalk.red(`Missing required env var: ${name}`));
    process.exit(1);
  }
  return value;
}

function getRpcUrl(): string {
  return process.env.RPC_URL || process.env.BASE_RPC_URL || requireEnv('RPC_URL');
}

function getSafeFlowContract(): string {
  return process.env.SAFEFLOW_CONTRACT || process.env.NEXT_PUBLIC_SAFEFLOW_CONTRACT || requireEnv('SAFEFLOW_CONTRACT');
}

function getDefaultChainId(): number {
  return Number(process.env.CHAIN_ID || process.env.SAFEFLOW_CHAIN_ID || '8453');
}

function parseBackend(value: string | undefined): BackendMode {
  if (!value) return 'auto';
  if (value === 'auto' || value === 'cast' || value === 'viem') return value;
  throw new Error(`Invalid backend: ${value}. Expected auto, cast, or viem.`);
}

function asAddress(value: string): `0x${string}` {
  return value as `0x${string}`;
}

function asHex(value: string): `0x${string}` {
  return value as `0x${string}`;
}

async function getContractRuntimeForOptions(opts: { backend?: string; chainId?: string | number }) {
  const chainId = typeof opts.chainId === 'number' ? opts.chainId : Number(opts.chainId || getDefaultChainId());
  return createContractRuntime({
    backend: parseBackend(opts.backend),
    rpcUrl: getRpcUrl(),
    chainId,
    promptForFoundry: true,
  });
}

async function fetchQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress: string;
  fromAmount: string;
}): Promise<ComposerQuote> {
  const searchParams = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    fromAmount: params.fromAmount,
  });

  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = process.env.LIFI_API_KEY || process.env.NEXT_PUBLIC_LIFI_API_KEY;
  if (apiKey) {
    headers['x-lifi-api-key'] = apiKey;
  }

  const res = await fetch(`${COMPOSER_API}/v1/quote?${searchParams.toString()}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Composer API error (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

function buildEvidenceHash(payload: Record<string, unknown>): string {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

async function fetchVaults(opts: {
  chainId?: number;
  limit?: number;
}): Promise<Vault[]> {
  const params = new URLSearchParams();
  if (opts.chainId) params.set('chainId', String(opts.chainId));
  if (opts.limit) params.set('limit', String(opts.limit));

  const res = await fetch(`${EARN_API}/v1/earn/vaults?${params.toString()}`);
  if (!res.ok) throw new Error(`Earn API error: ${res.status}`);
  const json = await res.json();
  return json.data || json;
}

const program = new Command();

program
  .name('safeflow')
  .description('SafeFlow Yield Agent CLI — discover and manage DeFi yield vaults')
  .version('0.1.0');

// ─── vault list ──────────────────────────────────────────────

program
  .command('vault')
  .description('Manage yield vaults')
  .command('list')
  .description('List yield vaults from LI.FI Earn API')
  .option('-c, --chain <chain>', 'Filter by chain name (base, arbitrum, ethereum, ...)')
  .option('-t, --token <symbol>', 'Filter by token symbol (USDC, ETH, ...)')
  .option('-p, --protocol <name>', 'Filter by protocol name')
  .option('--tag <tag>', 'Filter by tag (stablecoin, blue-chip, lsd)')
  .option('--min-apy <number>', 'Minimum APY percentage', parseFloat)
  .option('--min-tvl <number>', 'Minimum TVL in USD', parseFloat)
  .option('-n, --limit <number>', 'Number of results', parseInt, 20)
  .option('--sort <field>', 'Sort by field (apy, tvl)', 'apy')
  .option('--asc', 'Sort ascending instead of descending')
  .option('--transactional', 'Only show transactional vaults', true)
  .action(async (opts) => {
    try {
      console.log(chalk.bold('\n🔍 Fetching vaults from LI.FI Earn API...\n'));

      const chainId = opts.chain ? CHAIN_MAP[opts.chain.toLowerCase()] : undefined;
      if (opts.chain && !chainId) {
        console.error(chalk.red(`Unknown chain: ${opts.chain}`));
        console.log(chalk.dim(`Available: ${Object.keys(CHAIN_MAP).filter(k => k.length > 3).join(', ')}`));
        process.exit(1);
      }

      let vaults = await fetchVaults({ chainId, limit: 100 });

      // Filters
      if (opts.transactional) {
        vaults = vaults.filter(v => v.isTransactional === true);
      }
      if (opts.token) {
        const sym = opts.token.toUpperCase();
        vaults = vaults.filter(v => v.underlyingTokens?.some(t => t.symbol?.toUpperCase() === sym));
      }
      if (opts.protocol) {
        const p = opts.protocol.toLowerCase();
        vaults = vaults.filter(v => v.protocol?.name?.toLowerCase().includes(p));
      }
      if (opts.tag) {
        vaults = vaults.filter(v => v.tags?.includes(opts.tag));
      }
      if (opts.minApy != null) {
        vaults = vaults.filter(v => (v.analytics?.apy?.total ?? 0) >= opts.minApy);
      }
      if (opts.minTvl != null) {
        vaults = vaults.filter(v => Number(v.analytics?.tvl?.usd ?? '0') >= opts.minTvl);
      }

      // Sort
      const dir = opts.asc ? 1 : -1;
      if (opts.sort === 'tvl') {
        vaults.sort((a, b) => dir * (Number(a.analytics?.tvl?.usd ?? 0) - Number(b.analytics?.tvl?.usd ?? 0)));
      } else {
        vaults.sort((a, b) => dir * ((a.analytics?.apy?.total ?? 0) - (b.analytics?.apy?.total ?? 0)));
      }

      const display = vaults.slice(0, opts.limit);

      if (display.length === 0) {
        console.log(chalk.yellow('No vaults found matching your criteria.\n'));
        return;
      }

      // Table header
      const header = [
        '#'.padStart(3),
        'Vault'.padEnd(35),
        'Protocol'.padEnd(14),
        'Chain'.padEnd(12),
        'Token'.padEnd(12),
        'APY'.padStart(10),
        'TVL'.padStart(12),
        'Tags',
      ].join('  ');

      console.log(chalk.dim(header));
      console.log(chalk.dim('─'.repeat(header.length + 10)));

      display.forEach((v, i) => {
        const tokens = v.underlyingTokens?.map(t => t.symbol).join('/') || '?';
        const tags = v.tags?.slice(0, 2).join(', ') || '';
        const row = [
          String(i + 1).padStart(3),
          (v.name || '').slice(0, 35).padEnd(35),
          (v.protocol?.name || '').slice(0, 14).padEnd(14),
          (v.network || `${v.chainId}`).padEnd(12),
          tokens.padEnd(12),
          formatApy(v.analytics?.apy?.total).padStart(10),
          formatTvl(v.analytics?.tvl?.usd).padStart(12),
          chalk.dim(tags),
        ].join('  ');
        console.log(row);
      });

      console.log(chalk.dim(`\n${display.length} vaults shown (of ${vaults.length} matching)\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ─── vault info ──────────────────────────────────────────────

program
  .command('info')
  .description('Show vault details')
  .argument('<address>', 'Vault contract address')
  .option('-c, --chain <chain>', 'Chain name', 'base')
  .action(async (address, opts) => {
    try {
      const chainId = CHAIN_MAP[opts.chain.toLowerCase()];
      if (!chainId) {
        console.error(chalk.red(`Unknown chain: ${opts.chain}`));
        process.exit(1);
      }

      const vaults = await fetchVaults({ chainId, limit: 100 });
      const vault = vaults.find(v => v.address.toLowerCase() === address.toLowerCase());

      if (!vault) {
        console.log(chalk.yellow(`Vault not found: ${address}`));
        return;
      }

      console.log(`\n${chalk.bold(vault.name)}`);
      console.log(chalk.dim(`${vault.protocol?.name} • ${vault.network}\n`));
      console.log(`  APY (total):  ${formatApy(vault.analytics?.apy?.total)}`);
      console.log(`  APY (base):   ${formatApy(vault.analytics?.apy?.base)}`);
      console.log(`  APY (reward): ${formatApy(vault.analytics?.apy?.reward)}`);
      console.log(`  TVL:          ${formatTvl(vault.analytics?.tvl?.usd)}`);
      console.log(`  Tokens:       ${vault.underlyingTokens?.map(t => t.symbol).join(', ')}`);
      console.log(`  Tags:         ${vault.tags?.join(', ') || 'none'}`);
      console.log(`  Address:      ${chalk.dim(vault.address)}`);
      console.log(`  Transactional: ${vault.isTransactional ? chalk.green('yes') : chalk.red('no')}\n`);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ─── portfolio ───────────────────────────────────────────────

program
  .command('portfolio')
  .description('Show yield portfolio positions')
  .argument('<address>', 'Wallet address')
  .action(async (address) => {
    try {
      console.log(chalk.bold(`\n📊 Fetching portfolio for ${chalk.dim(address)}...\n`));

      const res = await fetch(`${EARN_API}/v1/earn/portfolio/${address}/positions`);
      if (!res.ok) {
        if (res.status === 404) {
          console.log(chalk.yellow('No positions found for this address.\n'));
          return;
        }
        throw new Error(`Portfolio API error: ${res.status}`);
      }

      const positions = await res.json();
      if (!Array.isArray(positions) || positions.length === 0) {
        console.log(chalk.yellow('No positions found.\n'));
        return;
      }

      positions.forEach((pos: any, i: number) => {
        console.log(`${chalk.bold(`${i + 1}. ${pos.vault?.name || 'Unknown'}`)}`);
        console.log(`   Protocol: ${pos.vault?.protocol?.name || '?'}`);
        console.log(`   Balance:  ${pos.balanceToken || '?'} ${pos.tokenSymbol || ''} (${chalk.cyan('$' + (pos.balanceUsd || '?'))})`);
        if (pos.pnlUsd) console.log(`   PnL:      ${chalk.green('$' + pos.pnlUsd)}`);
        console.log();
      });
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

const contract = program
  .command('contract')
  .description('Operate the deployed SafeFlowVault contract');

contract
  .command('create-wallet')
  .description('Create a SafeFlow wallet on-chain')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--chain-id <number>', 'Chain ID', String(getDefaultChainId()))
  .action(async (opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      console.log(chalk.bold('\n🔐 Creating SafeFlow wallet...\n'));
      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      const result = await runtime.createWallet(contractAddress);
      console.log(chalk.green(`Success: ${result}\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

contract
  .command('fund-wallet')
  .description('Approve a token and deposit it into a SafeFlow wallet')
  .requiredOption('--wallet-id <id>', 'Wallet ID')
  .requiredOption('--token <address>', 'ERC20 token address')
  .requiredOption('--amount <amount>', 'Human-readable token amount, e.g. 0.02')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--chain-id <number>', 'Chain ID', String(getDefaultChainId()))
  .option('--decimals <number>', 'Token decimals', '6')
  .action(async (opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      const decimals = parseInt(opts.decimals, 10);
      const amount = BigInt(parseTokenAmount(opts.amount, decimals));
      const token = asAddress(opts.token);

      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      console.log(chalk.bold('\n💸 Approving token to SafeFlowVault...\n'));
      const approval = await runtime.approveToken(token, contractAddress, amount);
      console.log(chalk.green(`Approval tx: ${approval}`));

      console.log(chalk.bold('\n🏦 Funding SafeFlow wallet...\n'));
      const deposit = await runtime.depositToWallet(contractAddress, BigInt(opts.walletId), token, amount);
      console.log(chalk.green(`Deposit tx: ${deposit}\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

contract
  .command('create-cap')
  .description('Create a SessionCap for an agent')
  .requiredOption('--wallet-id <id>', 'Wallet ID')
  .requiredOption('--agent <address>', 'Agent address')
  .requiredOption('--max-per-interval <amount>', 'Max per interval in raw units')
  .requiredOption('--max-total <amount>', 'Max total in raw units')
  .requiredOption('--interval-seconds <seconds>', 'Interval in seconds')
  .requiredOption('--expires-at <timestamp>', 'Expiry unix timestamp')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--chain-id <number>', 'Chain ID', String(getDefaultChainId()))
  .action(async (opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      console.log(chalk.bold('\n🛡️ Creating SessionCap...\n'));
      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      const result = await runtime.createSessionCap(
        contractAddress,
        BigInt(opts.walletId),
        asAddress(opts.agent),
        BigInt(opts.maxPerInterval),
        BigInt(opts.maxTotal),
        BigInt(opts.intervalSeconds),
        BigInt(opts.expiresAt),
      );
      console.log(chalk.green(`Success: ${result}\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

contract
  .command('revoke-cap')
  .description('Revoke an existing SessionCap')
  .argument('<capId>', 'Cap ID')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--chain-id <number>', 'Chain ID', String(getDefaultChainId()))
  .action(async (capId, opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      console.log(chalk.bold(`\n⛔ Revoking SessionCap ${capId}...\n`));
      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      const result = await runtime.revokeSessionCap(contractAddress, BigInt(capId));
      console.log(chalk.green(`Success: ${result}\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

contract
  .command('cap-info')
  .description('Query SessionCap info and remaining allowance')
  .argument('<capId>', 'Cap ID')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--chain-id <number>', 'Chain ID', String(getDefaultChainId()))
  .action(async (capId, opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      console.log(chalk.bold(`\n🔎 Querying SessionCap ${capId}...\n`));
      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      const cap = await runtime.getSessionCap(contractAddress, BigInt(capId));
      const remaining = await runtime.getRemainingAllowance(contractAddress, BigInt(capId));
      console.log(chalk.dim('SessionCap:'));
      console.log({
        walletId: cap.walletId.toString(),
        agent: cap.agent,
        maxSpendPerInterval: cap.maxSpendPerInterval.toString(),
        maxSpendTotal: cap.maxSpendTotal.toString(),
        intervalSeconds: cap.intervalSeconds.toString(),
        expiresAt: cap.expiresAt.toString(),
        totalSpent: cap.totalSpent.toString(),
        lastSpendTime: cap.lastSpendTime.toString(),
        currentIntervalSpent: cap.currentIntervalSpent.toString(),
        active: cap.active,
      });
      console.log();
      console.log(chalk.dim('Remaining allowance:'));
      console.log({
        intervalRemaining: remaining.intervalRemaining.toString(),
        totalRemaining: remaining.totalRemaining.toString(),
      });
      console.log();
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

contract
  .command('execute-deposit')
  .description('Fund a SafeFlow wallet and execute a SessionCap-protected vault deposit')
  .requiredOption('--wallet-id <id>', 'Wallet ID')
  .requiredOption('--cap-id <id>', 'SessionCap ID')
  .requiredOption('--token <address>', 'Underlying token address')
  .requiredOption('--vault <address>', 'Vault token address from LI.FI Earn API')
  .requiredOption('--amount <amount>', 'Human-readable token amount, e.g. 0.02')
  .option('--backend <backend>', 'Execution backend: auto | cast | viem', 'auto')
  .option('--decimals <number>', 'Token decimals', '6')
  .option('--chain-id <number>', 'Chain ID', '8453')
  .action(async (opts) => {
    try {
      const contractAddress = asAddress(getSafeFlowContract());
      const runtime = await getContractRuntimeForOptions(opts);
      const decimals = parseInt(opts.decimals, 10);
      const chainId = parseInt(opts.chainId, 10);
      const amount = BigInt(parseTokenAmount(opts.amount, decimals));
      const token = asAddress(opts.token);

      console.log(chalk.dim(`Backend: ${runtime.backend}`));
      console.log(chalk.bold('\n💸 Approving token to SafeFlowVault...\n'));
      const approval = await runtime.approveToken(token, contractAddress, amount);
      console.log(chalk.green(`Approval tx: ${approval}`));

      console.log(chalk.bold('\n🏦 Funding SafeFlow wallet...\n'));
      const deposit = await runtime.depositToWallet(contractAddress, BigInt(opts.walletId), token, amount);
      console.log(chalk.green(`Wallet funding tx: ${deposit}`));

      console.log(chalk.bold('\n🧠 Fetching LI.FI quote for SafeFlow...\n'));
      const quote = await fetchQuote({
        fromChain: chainId,
        toChain: chainId,
        fromToken: opts.token,
        toToken: opts.vault,
        fromAddress: contractAddress,
        toAddress: contractAddress,
        fromAmount: amount.toString(),
      });

      if (BigInt(quote.transactionRequest.value || '0') !== BigInt(0)) {
        throw new Error('execute-deposit currently supports ERC20 routes only (quote value must be 0).');
      }

      const evidenceHash = buildEvidenceHash({
        walletId: opts.walletId,
        capId: opts.capId,
        token: opts.token,
        vault: opts.vault,
        quoteTarget: quote.transactionRequest.to,
        amount,
        chainId,
      });

      console.log(chalk.bold('\n🚀 Executing SafeFlowVault.executeDeposit...\n'));
      const execute = await runtime.executeDeposit(
        contractAddress,
        BigInt(opts.capId),
        token,
        amount,
        asAddress(quote.transactionRequest.to),
        asHex(evidenceHash),
        asHex(quote.transactionRequest.data),
      );
      console.log(chalk.green(`executeDeposit tx: ${execute}`));
      if (quote.estimate?.gasCosts?.[0]) {
        console.log(chalk.dim(`Estimated gas from LI.FI: $${quote.estimate.gasCosts[0].amountUSD}`));
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
