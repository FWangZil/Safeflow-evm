'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle, ExternalLink, AlertTriangle, Coins, TrendingUp, Shield } from 'lucide-react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import type { EarnVault, ComposerQuote } from '@/types';
import { formatApy, formatTvl } from '@/lib/earn-api';
import { useTranslation } from '@/i18n';

interface DepositModalProps {
  vault: EarnVault;
  onClose: () => void;
}

type DepositStep = 'input' | 'quoting' | 'confirm' | 'signing' | 'pending' | 'success' | 'error';

export default function DepositModal({ vault, onClose }: DepositModalProps) {
  const { t } = useTranslation();
  const { address, isConnected, chainId } = useAccount();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<DepositStep>('input');
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { sendTransactionAsync } = useSendTransaction();

  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isTxSuccess && step === 'pending') {
      setStep('success');
      // Record audit
      recordAudit(txHash!).catch(() => {});
    }
  }, [isTxSuccess, step, txHash]);

  const underlyingToken = vault.underlyingTokens?.[0];
  const tokenSymbol = underlyingToken?.symbol || '?';
  const tokenDecimals = underlyingToken?.decimals || 18;

  const fetchQuote = useCallback(async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;

    setStep('quoting');
    setError(null);

    try {
      const fromAmount = parseUnits(amount, tokenDecimals).toString();

      const params = new URLSearchParams({
        fromChain: String(vault.chainId),
        toChain: String(vault.chainId),
        fromToken: underlyingToken.address,
        toToken: vault.address,
        fromAddress: address,
        toAddress: address,
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
    if (!quote?.transactionRequest) return;

    setStep('signing');
    setError(null);

    try {
      const tx = quote.transactionRequest;
      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value || '0'),
        chainId: tx.chainId,
      });

      setTxHash(hash);
      setStep('pending');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      if (msg.includes('User rejected') || msg.includes('denied')) {
        setStep('confirm');
        return;
      }
      setError(msg);
      setStep('error');
    }
  }, [quote, sendTransactionAsync]);

  const recordAudit = async (hash: string) => {
    try {
      const auditRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: address,
          action: 'deposit',
          vault: vault.address,
          vaultName: vault.name,
          token: tokenSymbol,
          amount: parseUnits(amount, tokenDecimals).toString(),
          reasoning: `User deposited ${amount} ${tokenSymbol} into ${vault.name} (${vault.protocol?.name}) on ${vault.network}`,
          riskScore: 1,
        }),
      });
      const auditData = await auditRes.json();
      // Update with tx hash
      if (auditData.entry?.id) {
        await fetch('/api/audit', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: auditData.entry.id, txHash: hash, status: 'executed' }),
        });
      }
    } catch {
      // Non-critical
    }
  };

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
              disabled={!amount || parseFloat(amount) <= 0}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Get Quote
            </button>
          </div>
        ) : step === 'quoting' ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Building transaction via LI.FI Composer...</p>
          </div>
        ) : step === 'confirm' && quote ? (
          <div className="space-y-3">
            <div className="p-3 bg-secondary/50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit</span>
                <span className="font-data font-semibold">{amount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vault</span>
                <span className="font-data">{vault.name}</span>
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
                Confirm Deposit
              </button>
            </div>
          </div>
        ) : step === 'signing' ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Please sign the transaction in your wallet...</p>
          </div>
        ) : step === 'pending' ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Transaction submitted. Waiting for confirmation...</p>
            {txHash && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                View on Explorer <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ) : step === 'success' ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-sm font-semibold">Deposit Successful!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {amount} {tokenSymbol} deposited into {vault.name}
            </p>
            {txHash && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
                View on Explorer <ExternalLink className="w-3 h-3" />
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
            {t('vaultModal.protectedNote')}
          </p>
        )}
      </div>
    </div>
  );
}
