#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_FILE);
const ROOT_DIR = resolve(SCRIPT_DIR, '..');
const CONTRACTS_DIR = join(ROOT_DIR, 'contracts');
const WEB_ENV_PATH = join(ROOT_DIR, 'web', '.env');
const MANIFESTS_DIR = join(ROOT_DIR, 'docs', 'deployments');

const NETWORKS = {
  base: {
    chainId: 8453,
    rpcEnvCandidates: ['BASE_RPC_URL', 'RPC_URL'],
  },
  base_sepolia: {
    chainId: 84532,
    rpcEnvCandidates: ['BASE_SEPOLIA_RPC_URL', 'RPC_URL'],
  },
  arbitrum_sepolia: {
    chainId: 421614,
    rpcEnvCandidates: ['ARBITRUM_SEPOLIA_RPC_URL', 'RPC_URL'],
  },
};

function printHelp() {
  console.log(`Usage: node scripts/deploy-contract-and-configure-web.mjs [options]\n\nOptions:\n  --network <name>   Target network (${Object.keys(NETWORKS).join(', ')})\n  --force            Force redeploy even if a deployment already exists\n  --web-env <path>   Override web env file path\n  --help             Show this help\n`);
}

function parseArgs(argv) {
  const options = {
    network: process.env.SAFEFLOW_NETWORK || 'base_sepolia',
    force: false,
    webEnvPath: WEB_ENV_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--network') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --network');
      options.network = value;
      index += 1;
      continue;
    }
    if (arg === '--web-env') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --web-env');
      options.webEnvPath = resolve(ROOT_DIR, value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function requireNetworkConfig(network) {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}. Expected one of ${Object.keys(NETWORKS).join(', ')}`);
  }
  return config;
}

function resolveRpcConfig(network) {
  const networkConfig = requireNetworkConfig(network);
  for (const envName of networkConfig.rpcEnvCandidates) {
    const value = process.env[envName];
    if (value) {
      return { rpcUrl: value, rpcEnvName: envName, chainId: networkConfig.chainId };
    }
  }
  throw new Error(`Missing RPC URL for ${network}. Set one of ${networkConfig.rpcEnvCandidates.join(', ')}`);
}

function requirePrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing PRIVATE_KEY in environment.');
  }
  return privateKey;
}

async function commandExists(command, args = ['--version']) {
  return new Promise(resolvePromise => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', () => resolvePromise(false));
    child.on('exit', code => resolvePromise(code === 0));
  });
}

async function ensureForgeInstalled() {
  const installed = await commandExists('forge');
  if (!installed) {
    throw new Error('Foundry `forge` command is required. Install Foundry first, then rerun this script.');
  }
}

async function readTextFile(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function parseEnvValue(content, key) {
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

async function fetchContractCode(rpcUrl, address) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message || 'unknown error'}`);
  }

  return typeof json.result === 'string' ? json.result : '0x';
}

async function isLiveContract(rpcUrl, address) {
  if (!address || address === ZERO_ADDRESS) return false;
  const code = await fetchContractCode(rpcUrl, address);
  return code !== '0x' && code !== '0x0';
}

async function findLatestManifestForNetwork(network) {
  const latestPointerPath = join(MANIFESTS_DIR, `latest.${network}.json`);
  const latestPointerContent = await readTextFile(latestPointerPath);
  if (latestPointerContent) {
    return { path: latestPointerPath, data: JSON.parse(latestPointerContent) };
  }

  try {
    const entries = await readdir(MANIFESTS_DIR);
    const candidates = entries
      .filter(entry => entry.endsWith(`-${network}.json`))
      .sort()
      .reverse();

    for (const candidate of candidates) {
      const fullPath = join(MANIFESTS_DIR, candidate);
      const content = await readTextFile(fullPath);
      if (content) {
        return { path: fullPath, data: JSON.parse(content) };
      }
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  return null;
}

async function resolveExistingDeployment(network, rpcUrl, webEnvPath) {
  const manifestRecord = await findLatestManifestForNetwork(network);
  if (manifestRecord) {
    const address = manifestRecord.data?.contracts?.SafeFlowVault || manifestRecord.data?.contractAddress;
    if (typeof address === 'string' && await isLiveContract(rpcUrl, address)) {
      return {
        address,
        source: 'manifest',
        sourcePath: manifestRecord.path,
      };
    }
  }

  const webEnvContent = await readTextFile(webEnvPath);
  const envAddress = parseEnvValue(webEnvContent, 'NEXT_PUBLIC_SAFEFLOW_CONTRACT');
  if (envAddress && await isLiveContract(rpcUrl, envAddress)) {
    return {
      address: envAddress,
      source: 'web-env',
      sourcePath: webEnvPath,
    };
  }

  return null;
}

async function runForgeDeploy(rpcUrl) {
  await ensureForgeInstalled();
  requirePrivateKey();

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'forge',
      ['script', 'script/Deploy.s.sol:DeployScript', '--rpc-url', rpcUrl, '--broadcast'],
      {
        cwd: CONTRACTS_DIR,
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );

    let combinedOutput = '';

    const collect = chunk => {
      const text = chunk.toString();
      combinedOutput += text;
      return text;
    };

    child.stdout.on('data', chunk => {
      process.stdout.write(collect(chunk));
    });

    child.stderr.on('data', chunk => {
      process.stderr.write(collect(chunk));
    });

    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code !== 0) {
        rejectPromise(new Error(`forge script exited with code ${code ?? 'unknown'}`));
        return;
      }

      const matches = [
        combinedOutput.match(/SafeFlowVault deployed at:\s*(0x[a-fA-F0-9]{40})/),
        combinedOutput.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/),
      ];
      const address = matches.find(Boolean)?.[1];
      if (!address) {
        rejectPromise(new Error('Deployment succeeded but contract address could not be parsed from forge output.'));
        return;
      }

      resolvePromise(address);
    });
  });
}

async function updateWebEnv(webEnvPath, address) {
  const existing = await readTextFile(webEnvPath);
  const line = `NEXT_PUBLIC_SAFEFLOW_CONTRACT=${address}`;

  let nextContent;
  if (!existing) {
    nextContent = `${line}\n`;
  } else if (/^NEXT_PUBLIC_SAFEFLOW_CONTRACT=.*$/m.test(existing)) {
    nextContent = existing.replace(/^NEXT_PUBLIC_SAFEFLOW_CONTRACT=.*$/m, line);
  } else {
    nextContent = `${existing.replace(/\s*$/, '\n')}${line}\n`;
  }

  await writeFile(webEnvPath, nextContent, 'utf8');
}

function toFileTimestamp(isoString) {
  return isoString.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function writeDeploymentRecords(record) {
  await mkdir(MANIFESTS_DIR, { recursive: true });
  const timestamp = toFileTimestamp(record.timestamp);
  const historyPath = join(MANIFESTS_DIR, `${timestamp}-${record.network}.json`);
  const latestPath = join(MANIFESTS_DIR, `latest.${record.network}.json`);
  const content = `${JSON.stringify(record, null, 2)}\n`;

  await writeFile(historyPath, content, 'utf8');
  await writeFile(latestPath, content, 'utf8');

  return { historyPath, latestPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const { rpcUrl, rpcEnvName, chainId } = resolveRpcConfig(options.network);
  const existing = options.force ? null : await resolveExistingDeployment(options.network, rpcUrl, options.webEnvPath);

  let address;
  let status;
  let source;
  let sourcePath = null;

  if (existing) {
    address = existing.address;
    status = 'reused';
    source = existing.source;
    sourcePath = existing.sourcePath;
    console.log(`Using existing SafeFlowVault on ${options.network}: ${address}`);
  } else {
    console.log(`Deploying SafeFlowVault to ${options.network}...`);
    address = await runForgeDeploy(rpcUrl);
    status = 'deployed';
    source = 'forge-script';
    console.log(`Deployed SafeFlowVault to ${address}`);
  }

  const live = await isLiveContract(rpcUrl, address);
  if (!live) {
    throw new Error(`No contract code found at ${address} on ${options.network}`);
  }

  await updateWebEnv(options.webEnvPath, address);

  const record = {
    timestamp: new Date().toISOString(),
    network: options.network,
    chainId,
    status,
    forceRedeploy: options.force,
    rpcEnvName,
    contracts: {
      SafeFlowVault: address,
    },
    webEnvFile: options.webEnvPath,
    webEnv: {
      NEXT_PUBLIC_SAFEFLOW_CONTRACT: address,
    },
    source,
    sourcePath,
  };

  const { historyPath, latestPath } = await writeDeploymentRecords(record);

  console.log('');
  console.log(`Web env updated: ${options.webEnvPath}`);
  console.log(`Deployment record: ${historyPath}`);
  console.log(`Latest record: ${latestPath}`);
  console.log('');
  console.log('You can now start the web app with:');
  console.log('  npm run dev');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
