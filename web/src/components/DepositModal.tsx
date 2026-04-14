'use client';

import { useState, useCallback } from 'react';
import { X, Loader2, CheckCircle, ExternalLink, AlertTriangle, Coins, TrendingUp, Shield } from 'lucide-react';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { keccak256, parseUnits, stringToHex } from 'viem';
import type { EarnVault, ComposerQuote } from '@/types';
import { formatApy, formatTvl } from '@/lib/earn-api';
import { ERC20_ABI, getSafeFlowAddress, SAFEFLOW_VAULT_ABI } from '@/lib/contracts';
import { useTranslation } from '@/i18n';

interface DepositModalProps {
  vault: EarnVault;
  onClose: () => void;
}

type DepositStep = 'input' | 'quoting' | 'confirm' | 'executing' | 'success' | 'error';

export default function DepositModal({ vault, onClose }: DepositModalProps) {
  const { t } = useTranslation();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: vault.chainId });
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('0');
  const [capId, setCapId] = useState('0');
  const [step, setStep] = useState<DepositStep>('input');
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const underlyingToken = vault.underlyingTokens?.[0];
  const tokenSymbol = underlyingToken?.symbol || '?';
  const tokenDecimals = underlyingToken?.decimals || 18;
  const safeFlowAddress = (() => {
    try {
      return getSafeFlowAddress();
    } catch {
      return null;
    }
  })();
  const amountWei = amount && parseFloat(amount) > 0 ? parseUnits(amount, tokenDecimals) : BigInt(0);

  const { data: capData } = useReadContract({
    address: safeFlowAddress ?? undefined,
    abi: SAFEFLOW_VAULT_ABI,
    functionName: 'getSessionCap',
    args: safeFlowAddress ? [BigInt(capId || '0')] : undefined,
    query: { enabled: Boolean(safeFlowAddress && capId !== '') },
  });

  const { data: remainingAllowance } = useReadContract({
    address: safeFlowAddress ?? undefined,
    abi: SAFEFLOW_VAULT_ABI,
    functionName: 'getRemainingAllowance',
    args: safeFlowAddress ? [BigInt(capId || '0')] : undefined,
    query: { enabled: Boolean(safeFlowAddress && capId !== '') },
  });

  const { data: tokenAllowance } = useReadContract({
    address: underlyingToken?.address as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && safeFlowAddress ? [address, safeFlowAddress] : undefined,
    query: { enabled: Boolean(address && safeFlowAddress && underlyingToken?.address) },
  });

  const fetchQuote = useCallback(async () => {
    if (!address || !amount || parseFloat(amount) <= 0 || !safeFlowAddress || !underlyingToken) return;

    setStep('quoting');
    setError(null);

    try {
      if (!capData) {
        throw new Error('SessionCap not found. Please enter a valid cap ID.');
      }

      const cap = capData as {
        walletId: bigint;
        agent: string;
        expiresAt: bigint;
        active: boolean;
      };

      if (!cap.active) {
        throw new Error('SessionCap is not active.');
      }
      if (cap.walletId !== BigInt(walletId)) {
        throw new Error('Wallet ID does not match the selected SessionCap.');
      }
      if (cap.agent.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Connected wallet is not the authorized SessionCap agent.');
      }

      const fromAmount = parseUnits(amount, tokenDecimals).toString();

      const params = new URLSearchParams({
        fromChain: String(vault.chainId),
        toChain: String(vault.chainId),
        fromToken: underlyingToken.address,
        toToken: vault.address,
        fromAddress: safeFlowAddress,
        toAddress: safeFlowAddress,
        fromAmount,
      });

      const res = await fetch(`/api/earn/quote?${params.toString()}`);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Quote failed (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      setQuote(data);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
      setStep('error');
    }
  }, [address, amount, vault, underlyingToken, tokenDecimals]);

  const executeDeposit = useCallback(async () => {
    if (!quote?.transactionRequest || !safeFlowAddress || !underlyingToken || !publicClient || !address) return;

    setStep('executing');
    setError(null);

    try {
      const tx = quote.transactionRequest;
      if (BigInt(tx.value || '0') !== BigInt(0)) {
        throw new Error('SafeFlow executeDeposit currently supports ERC-20 deposits only.');
      }

      const cap = capData as {
        walletId: bigint;
        agent: string;
        active: boolean;
      } | undefined;

      if (!cap?.active) {
        throw new Error('SessionCap is not active.');
      }
      if (cap.walletId !== BigInt(walletId)) {
        throw new Error('Wallet ID does not match the selected SessionCap.');
      }
      if (cap.agent.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Connected wallet is not the authorized SessionCap agent.');
      }

      if (remainingAllowance) {
        const [intervalRemaining, totalRemaining] = remainingAllowance as [bigint, bigint];
        if (intervalRemaining < amountWei) {
          throw new Error('Amount exceeds the remaining per-interval SessionCap allowance.');
        }
        if (totalRemaining < amountWei) {
          throw new Error('Amount exceeds the remaining total SessionCap allowance.');
        }
      }

      const evidencePayload = JSON.stringify({
        walletId,
        capId,
        vault: vault.address,
        target: tx.to,
        token: underlyingToken.address,
        symbol: tokenSymbol,
        amount,
        chainId: vault.chainId,
      });
      const evidenceHash = keccak256(stringToHex(evidencePayload));

      const auditRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: address,
          action: 'executeDeposit',
          vault: tx.to,
          vaultName: vault.name,
          token: tokenSymbol,
          amount: amountWei.toString(),
          reasoning: `SafeFlow wallet ${walletId} executes SessionCap ${capId} deposit into ${vault.name} on ${vault.network}`,
          riskScore: 1,
        }),
      });
      const auditData = await auditRes.json().catch(() => null);

      if ((tokenAllowance as bigint | undefined) === undefined || (tokenAllowance as bigint) < amountWei) {
        setProgressLabel('Approving token to SafeFlowVault...');
        const approvalHash = await writeContractAsync({
          address: underlyingToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [safeFlowAddress, amountWei],
          chainId: vault.chainId,
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setProgressLabel('Funding SafeFlow wallet...');
      const fundHash = await writeContractAsync({
        address: safeFlowAddress,
        abi: SAFEFLOW_VAULT_ABI,
        functionName: 'deposit',
        args: [BigInt(walletId), underlyingToken.address as `0x${string}`, amountWei],
        chainId: vault.chainId,
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });

      setProgressLabel('Executing SessionCap-protected deposit...');
      const execHash = await writeContractAsync({
        address: safeFlowAddress,
        abi: SAFEFLOW_VAULT_ABI,
        functionName: 'executeDeposit',
        args: [
          BigInt(capId),
          underlyingToken.address as `0x${string}`,
          amountWei,
          tx.to as `0x${string}`,
          evidenceHash,
          tx.data as `0x${string}`,
        ],
        chainId: vault.chainId,
      });

      await publicClient.waitForTransactionReceipt({ hash: execHash });
      setTxHash(execHash);

      if (auditData?.entry?.id) {
        await fetch('/api/audit', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: auditData.entry.id, txHash: execHash, status: 'executed' }),
        });
      }

      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      if (msg.includes('User rejected') || msg.includes('denied')) {
        setStep('confirm');
        setProgressLabel('');
        return;
      }
      setError(msg);
      setProgressLabel('');
      setStep('error');
    }
  }, [address, amount, amountWei, capData, capId, publicClient, quote, remainingAllowance, safeFlowAddress, tokenAllowance, tokenSymbol, underlyingToken, vault, walletId, writeContractAsync]);

  const explorerUrl = vault.chainId === 8453
    ? `https://basescan.org/tx/${txHash}`
    : vault.chainId === 42161
    ? `https://arbiscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;

  const isWrongChain = isConnected && chainId !== vault.chainId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in-up" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold leading-tight">{vault.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{vault.protocol?.name} · {vault.network}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="p-3 bg-input rounded-xl border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.totalApy')}</div>
            <div className="text-lg font-bold text-success font-data text-glow-success mt-0.5">
              {vault.analytics?.apy?.total?.toFixed(2) ?? t('common.na')}%
            </div>
          </div>
          <div className="p-3 bg-input rounded-xl border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.tvl')}</div>
            <div className="text-lg font-bold font-data mt-0.5">
              {formatTvl(vault.analytics?.tvl?.usd)}
            </div>
          </div>
          <div className="p-3 bg-input rounded-xl border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.baseApy')}</div>
            <div className="font-medium font-data mt-0.5">{vault.analytics?.apy?.base?.toFixed(2) ?? t('common.na')}%</div>
          </div>
          <div className="p-3 bg-input rounded-xl border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.rewardApy')}</div>
            <div className="font-medium font-data mt-0.5">{vault.analytics?.apy?.reward?.toFixed(2) ?? '0'}%</div>
          </div>
        </div>

        {/* APY Trends */}
        {(vault.analytics?.apy1d != null || vault.analytics?.apy7d != null || vault.analytics?.apy30d != null) && (
          <div className="flex gap-2 mb-4">
            {vault.analytics.apy1d != null && (
              <div className="flex-1 p-2 bg-secondary/50 rounded-lg text-center">
                <div className="text-[9px] text-muted-foreground uppercase">1d</div>
                <div className="text-xs font-bold font-data">{vault.analytics.apy1d.toFixed(2)}%</div>
              </div>
            )}
            {vault.analytics.apy7d != null && (
              <div className="flex-1 p-2 bg-secondary/50 rounded-lg text-center">
                <div className="text-[9px] text-muted-foreground uppercase">7d</div>
                <div className="text-xs font-bold font-data">{vault.analytics.apy7d.toFixed(2)}%</div>
              </div>
            )}
            {vault.analytics.apy30d != null && (
              <div className="flex-1 p-2 bg-secondary/50 rounded-lg text-center">
                <div className="text-[9px] text-muted-foreground uppercase">30d</div>
                <div className="text-xs font-bold font-data">{vault.analytics.apy30d.toFixed(2)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Tokens & Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {vault.underlyingTokens?.map(vt => (
            <span key={vt.address} className="px-2.5 py-1 bg-secondary rounded-md text-xs font-semibold font-data flex items-center gap-1">
              <Coins className="w-3 h-3" />{vt.symbol}
            </span>
          ))}
          {vault.tags?.map(tag => (
            <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-[11px] font-medium">{tag}</span>
          ))}
        </div>

        {/* Deposit Flow */}
        {!isConnected ? (
          <div className="p-4 bg-secondary/50 rounded-xl text-center text-sm text-muted-foreground">
            Please connect your wallet to deposit.
          </div>
        ) : !safeFlowAddress ? (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl text-center text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-1.5 text-warning" />
            SafeFlow contract is not configured. Deploy the contract and set `NEXT_PUBLIC_SAFEFLOW_CONTRACT` first.
          </div>
        ) : isWrongChain ? (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl text-center text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-1.5 text-warning" />
            Please switch to {vault.network} (Chain {vault.chainId}) to deposit.
          </div>
        ) : step === 'input' || step === 'error' ? (
          <div className="space-y-3">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
                {error}
              </div>
            )}
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                SafeFlow Wallet ID
              </label>
              <input
                type="number"
                min="0"
                value={walletId}
                onChange={e => setWalletId(e.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-data focus:outline-none focus:ring-1 focus:ring-primary/40 mb-3"
              />

              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                SessionCap ID
              </label>
              <input
                type="number"
                min="0"
                value={capId}
                onChange={e => setCapId(e.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-data focus:outline-none focus:ring-1 focus:ring-primary/40 mb-3"
              />

              {capData && (
                <div className="p-3 mb-3 bg-secondary/50 rounded-xl space-y-1 text-[11px] font-data">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cap agent</span>
                    <span className={(capData as { agent: string }).agent.toLowerCase() === address?.toLowerCase() ? 'text-success' : 'text-destructive'}>
                      {(capData as { agent: string }).agent.slice(0, 6)}...{(capData as { agent: string }).agent.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cap wallet</span>
                    <span>{String((capData as { walletId: bigint }).walletId)}</span>
                  </div>
                  {remainingAllowance && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interval remaining</span>
                        <span>{String((remainingAllowance as [bigint, bigint])[0])}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total remaining</span>
                        <span>{String((remainingAllowance as [bigint, bigint])[1])}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                Amount ({tokenSymbol})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`0.00 ${tokenSymbol}`}
                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm font-data focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex gap-1.5 mt-1.5">
                {['0.01', '0.02', '0.05', '0.1'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className="px-2 py-0.5 bg-secondary/80 rounded-md text-[10px] font-data hover:bg-secondary transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={fetchQuote}
              disabled={!amount || parseFloat(amount) <= 0 || !walletId || !capId}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Build SafeFlow Quote
            </button>
          </div>
        ) : step === 'quoting' ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Building SafeFlow-compatible transaction via LI.FI Composer...</p>
          </div>
        ) : step === 'confirm' && quote ? (
          <div className="space-y-3">
            <div className="p-3 bg-secondary/50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallet ID</span>
                <span className="font-data">{walletId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SessionCap ID</span>
                <span className="font-data">{capId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit</span>
                <span className="font-data font-semibold">{amount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vault</span>
                <span className="font-data">{vault.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Execution</span>
                <span className="font-data">approve → fund wallet → executeDeposit</span>
              </div>
              {quote.estimate?.gasCosts?.[0] && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Gas</span>
                  <span className="font-data">${quote.estimate.gasCosts[0].amountUSD}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chain</span>
                <span className="font-data">{vault.network}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('input'); setQuote(null); }}
                className="flex-1 px-4 py-3 border border-border rounded-xl text-sm font-semibold hover:bg-secondary transition-colors"
              >
                Back
              </button>
              <button
                onClick={executeDeposit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                Execute via SafeFlow
              </button>
            </div>
          </div>
        ) : step === 'executing' ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{progressLabel || 'Preparing SafeFlow transaction flow...'}</p>
          </div>
        ) : step === 'success' ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-sm font-semibold">SessionCap-Protected Deposit Successful!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {amount} {tokenSymbol} moved through SafeFlow wallet {walletId} into {vault.name}
            </p>
            {txHash && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
                View executeDeposit on Explorer <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-3 border border-border rounded-xl text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Close
            </button>
          </div>
        ) : null}

        {step === 'input' && (
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            SessionCap protection is enforced by SafeFlowVault.executeDeposit()
          </p>
        )}
      </div>
    </div>
  );
}
