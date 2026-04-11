'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Wallet, Plus, ShieldCheck, ShieldOff, Loader2, CheckCircle, ExternalLink, AlertTriangle, Key } from 'lucide-react';
import { SAFEFLOW_VAULT_ABI } from '@/lib/contracts';
import { useTranslation } from '@/i18n';

type Step = 'idle' | 'pending' | 'success' | 'error';

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_SAFEFLOW_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const IS_CONFIGURED = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

export default function SessionManager() {
  const { t } = useTranslation();
  const { address, isConnected, chainId } = useAccount();

  // ─── Create Wallet ──────────────────────────────────────
  const [walletStep, setWalletStep] = useState<Step>('idle');
  const { writeContractAsync } = useWriteContract();
  const [walletTxHash, setWalletTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: walletTxSuccess } = useWaitForTransactionReceipt({ hash: walletTxHash });

  useEffect(() => {
    if (walletTxSuccess && walletStep === 'pending') setWalletStep('success');
  }, [walletTxSuccess, walletStep]);

  const createWallet = async () => {
    try {
      setWalletStep('pending');
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: SAFEFLOW_VAULT_ABI,
        functionName: 'createWallet',
      });
      setWalletTxHash(hash);
    } catch (err) {
      console.error(err);
      setWalletStep('error');
    }
  };

  // ─── Create SessionCap ──────────────────────────────────
  const [capStep, setCapStep] = useState<Step>('idle');
  const [capForm, setCapForm] = useState({
    walletId: '0',
    agentAddress: '',
    maxPerInterval: '1000000', // 1 USDC (6 decimals)
    maxTotal: '5000000', // 5 USDC
    intervalSeconds: '3600',
    expiryHours: '24',
  });
  const [capTxHash, setCapTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: capTxSuccess } = useWaitForTransactionReceipt({ hash: capTxHash });

  useEffect(() => {
    if (capTxSuccess && capStep === 'pending') setCapStep('success');
  }, [capTxSuccess, capStep]);

  const createSessionCap = async () => {
    try {
      setCapStep('pending');
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + parseInt(capForm.expiryHours) * 3600);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: SAFEFLOW_VAULT_ABI,
        functionName: 'createSessionCap',
        args: [
          BigInt(capForm.walletId),
          capForm.agentAddress as `0x${string}`,
          BigInt(capForm.maxPerInterval),
          BigInt(capForm.maxTotal),
          BigInt(capForm.intervalSeconds),
          expiresAt,
        ],
      });
      setCapTxHash(hash);
    } catch (err) {
      console.error(err);
      setCapStep('error');
    }
  };

  // ─── Revoke SessionCap ──────────────────────────────────
  const [revokeCapId, setRevokeCapId] = useState('');
  const [revokeStep, setRevokeStep] = useState<Step>('idle');
  const [revokeTxHash, setRevokeTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: revokeTxSuccess } = useWaitForTransactionReceipt({ hash: revokeTxHash });

  useEffect(() => {
    if (revokeTxSuccess && revokeStep === 'pending') setRevokeStep('success');
  }, [revokeTxSuccess, revokeStep]);

  const revokeSessionCap = async () => {
    try {
      setRevokeStep('pending');
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: SAFEFLOW_VAULT_ABI,
        functionName: 'revokeSessionCap',
        args: [BigInt(revokeCapId)],
      });
      setRevokeTxHash(hash);
    } catch (err) {
      console.error(err);
      setRevokeStep('error');
    }
  };

  // ─── Read SessionCap ────────────────────────────────────
  const [queryCapId, setQueryCapId] = useState('');
  const [queryEnabled, setQueryEnabled] = useState(false);

  const { data: capData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SAFEFLOW_VAULT_ABI,
    functionName: 'getSessionCap',
    args: queryEnabled ? [BigInt(queryCapId || '0')] : undefined,
    query: { enabled: queryEnabled && IS_CONFIGURED },
  });

  const { data: allowanceData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SAFEFLOW_VAULT_ABI,
    functionName: 'getRemainingAllowance',
    args: queryEnabled ? [BigInt(queryCapId || '0')] : undefined,
    query: { enabled: queryEnabled && IS_CONFIGURED },
  });

  const explorerBase = chainId === 8453 ? 'https://basescan.org' : chainId === 42161 ? 'https://arbiscan.io' : 'https://etherscan.io';

  if (!isConnected) {
    return (
      <div className="p-10 border border-border rounded-xl bg-card/60 text-center glow-border">
        <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Connect your wallet to manage SessionCaps.</p>
      </div>
    );
  }

  if (!IS_CONFIGURED) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 p-4 bg-warning/10 border border-warning/20 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-1.5 text-warning" />
          SafeFlow contract not yet deployed. Set <code className="bg-secondary px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_SAFEFLOW_CONTRACT</code> in <code className="bg-secondary px-1 py-0.5 rounded text-xs">.env</code> after deployment.
        </div>
        {renderCapFormUI()}
      </div>
    );
  }

  function renderCapFormUI() {
    return (
      <>
        {/* Create Wallet */}
        <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Create Wallet
          </h3>
          <p className="text-xs text-muted-foreground">Create an on-chain wallet in SafeFlowVault. You become the owner.</p>
          {walletStep === 'success' ? (
            <div className="flex items-center gap-2 text-success text-xs">
              <CheckCircle className="w-4 h-4" /> Wallet created!
              {walletTxHash && (
                <a href={`${explorerBase}/tx/${walletTxHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={createWallet}
              disabled={walletStep === 'pending' || !IS_CONFIGURED}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {walletStep === 'pending' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Wallet'}
            </button>
          )}
          {walletStep === 'error' && <p className="text-destructive text-xs">Transaction failed. Please try again.</p>}
        </div>

        {/* Create SessionCap */}
        <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {t('settings.createSessionCap')}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Wallet ID</label>
              <input
                type="number" min="0" value={capForm.walletId}
                onChange={e => setCapForm(f => ({ ...f, walletId: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.agentAddress')}</label>
              <input
                type="text" placeholder="0x..." value={capForm.agentAddress}
                onChange={e => setCapForm(f => ({ ...f, agentAddress: e.target.value }))}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.maxPerInterval')}</label>
                <input
                  type="text" placeholder="1000000" value={capForm.maxPerInterval}
                  onChange={e => setCapForm(f => ({ ...f, maxPerInterval: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                />
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">raw units (1 USDC = 1000000)</p>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.maxTotal')}</label>
                <input
                  type="text" placeholder="5000000" value={capForm.maxTotal}
                  onChange={e => setCapForm(f => ({ ...f, maxTotal: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.intervalSeconds')}</label>
                <input
                  type="text" placeholder="3600" value={capForm.intervalSeconds}
                  onChange={e => setCapForm(f => ({ ...f, intervalSeconds: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Expiry (hours)</label>
                <input
                  type="text" placeholder="24" value={capForm.expiryHours}
                  onChange={e => setCapForm(f => ({ ...f, expiryHours: e.target.value }))}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                />
              </div>
            </div>
            {capStep === 'success' ? (
              <div className="flex items-center gap-2 text-success text-xs">
                <CheckCircle className="w-4 h-4" /> SessionCap created!
                {capTxHash && (
                  <a href={`${explorerBase}/tx/${capTxHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={createSessionCap}
                disabled={capStep === 'pending' || !capForm.agentAddress || !IS_CONFIGURED}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {capStep === 'pending' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('settings.createSessionCap')}
              </button>
            )}
            {capStep === 'error' && <p className="text-destructive text-xs">Transaction failed. Please try again.</p>}
          </div>
        </div>

        {/* Revoke SessionCap */}
        <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldOff className="w-4 h-4" /> Revoke SessionCap
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Cap ID</label>
              <input
                type="number" min="0" value={revokeCapId}
                onChange={e => setRevokeCapId(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
              />
            </div>
            {revokeStep === 'success' ? (
              <div className="flex items-center gap-2 text-success text-xs">
                <CheckCircle className="w-4 h-4" /> SessionCap revoked!
              </div>
            ) : (
              <button
                onClick={revokeSessionCap}
                disabled={revokeStep === 'pending' || !revokeCapId || !IS_CONFIGURED}
                className="w-full px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {revokeStep === 'pending' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Revoke'}
              </button>
            )}
          </div>
        </div>

        {/* Query SessionCap */}
        <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="w-4 h-4" /> Query SessionCap
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">Cap ID</label>
              <div className="flex gap-2">
                <input
                  type="number" min="0" value={queryCapId}
                  onChange={e => { setQueryCapId(e.target.value); setQueryEnabled(false); }}
                  className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                />
                <button
                  onClick={() => setQueryEnabled(true)}
                  disabled={!queryCapId || !IS_CONFIGURED}
                  className="px-4 py-2 bg-secondary rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-30"
                >
                  Query
                </button>
              </div>
            </div>
            {queryEnabled && capData && (
              <div className="p-3 bg-secondary/50 rounded-xl space-y-1.5 text-xs font-data">
                <div className="flex justify-between"><span className="text-muted-foreground">Wallet ID</span><span>{String((capData as any).walletId)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Agent</span><span className="truncate max-w-[200px]">{String((capData as any).agent)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max/Interval</span><span>{String((capData as any).maxSpendPerInterval)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Total</span><span>{String((capData as any).maxSpendTotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Spent</span><span>{String((capData as any).totalSpent)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span>{(capData as any).active ? '✅ Yes' : '❌ No'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expires</span><span>{new Date(Number((capData as any).expiresAt) * 1000).toLocaleString()}</span></div>
                {allowanceData && (
                  <>
                    <div className="border-t border-border pt-1.5 mt-1.5" />
                    <div className="flex justify-between"><span className="text-muted-foreground">Interval Remaining</span><span>{String((allowanceData as any)[0])}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Remaining</span><span>{String((allowanceData as any)[1])}</span></div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Contract Info */}
      <div className="sm:col-span-2 p-3 bg-secondary/30 rounded-xl flex items-center justify-between text-xs">
        <span className="text-muted-foreground">SafeFlowVault Contract:</span>
        <a
          href={`${explorerBase}/address/${CONTRACT_ADDRESS}`}
          target="_blank" rel="noopener noreferrer"
          className="font-data text-primary hover:underline inline-flex items-center gap-1"
        >
          {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {renderCapFormUI()}
    </div>
  );
}
