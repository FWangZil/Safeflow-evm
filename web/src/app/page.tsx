'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, TrendingUp, MessageSquare, BarChart3, Settings } from 'lucide-react';
import VaultExplorer from '@/components/VaultExplorer';
import ChatAgent from '@/components/ChatAgent';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import { useTranslation } from '@/i18n';
import type { EarnVault } from '@/types';

type Tab = 'chat' | 'explore' | 'portfolio' | 'settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [selectedVault, setSelectedVault] = useState<EarnVault | null>(null);
  const { t } = useTranslation();

  const handleSelectVault = (vault: EarnVault) => {
    setSelectedVault(vault);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: t('nav.aiAgent'), icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'explore', label: t('nav.explore'), icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'portfolio', label: t('nav.portfolio'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col relative z-1">
      {/* Header */}
      <header className="glass header-accent sticky top-0 z-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary/20">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-bold tracking-tight">{t('app.title')}</h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{t('app.subtitle')}</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden sm:flex items-center gap-0.5 bg-secondary/60 rounded-lg p-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              <LangToggle />
              <ThemeToggle />
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
                  const connected = mounted && account && chain;
                  return (
                    <div>
                      {!connected ? (
                        <button
                          onClick={openConnectModal}
                          className="ml-1 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          {t('nav.connectWallet')}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={openChainModal}
                            className="px-2 py-1 bg-secondary rounded-md text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                          >
                            {chain.name}
                          </button>
                          <button
                            onClick={openAccountModal}
                            className="px-2.5 py-1 bg-secondary rounded-md text-[11px] font-mono font-medium hover:bg-secondary/80 transition-colors"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="sm:hidden flex border-b border-border glass">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <div className="w-4 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 relative z-1">
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto w-full animate-fade-in-up">
            <ChatAgent onSelectVault={handleSelectVault} />
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <h2 className="text-xl font-bold">{t('explore.title')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('explore.subtitle')}
              </p>
            </div>
            <VaultExplorer onSelectVault={handleSelectVault} />
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <h2 className="text-xl font-bold">{t('portfolio.title')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('portfolio.subtitle')}
              </p>
            </div>
            <div className="p-10 border border-border rounded-xl bg-card/60 text-center glow-border">
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('portfolio.connectPrompt')}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">{t('portfolio.dataSource')}</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <h2 className="text-xl font-bold">{t('settings.title')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('settings.subtitle')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
                <h3 className="text-sm font-semibold">{t('settings.spendingLimits')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.maxPerInterval')}</label>
                    <input
                      type="text"
                      placeholder="1000 USDC"
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.maxTotal')}</label>
                    <input
                      type="text"
                      placeholder="5000 USDC"
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.intervalSeconds')}</label>
                    <input
                      type="text"
                      placeholder="3600"
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border border-border rounded-xl bg-card/60 glow-border space-y-4">
                <h3 className="text-sm font-semibold">{t('settings.agentConfig')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.agentAddress')}</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-data"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-medium">{t('settings.expiry')}</label>
                    <input
                      type="datetime-local"
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <button className="w-full mt-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                    {t('settings.createSessionCap')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 mt-auto relative z-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[11px] text-muted-foreground/60">
          <span>{t('footer.left')}</span>
          <span>{t('footer.right')}</span>
        </div>
      </footer>

      {/* Vault Detail Modal */}
      {selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in-up" onClick={() => setSelectedVault(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold leading-tight">{selectedVault.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedVault.protocol?.name} · {selectedVault.network}</p>
              </div>
              <button onClick={() => setSelectedVault(null)} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="p-3 bg-input rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.totalApy')}</div>
                <div className="text-lg font-bold text-success font-data text-glow-success mt-0.5">
                  {selectedVault.analytics?.apy?.total?.toFixed(2) ?? t('common.na')}%
                </div>
              </div>
              <div className="p-3 bg-input rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.tvl')}</div>
                <div className="text-lg font-bold font-data mt-0.5">
                  {selectedVault.analytics?.tvl?.usd ? `$${(Number(selectedVault.analytics.tvl.usd) / 1e6).toFixed(2)}M` : t('common.na')}
                </div>
              </div>
              <div className="p-3 bg-input rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.baseApy')}</div>
                <div className="font-medium font-data mt-0.5">{selectedVault.analytics?.apy?.base?.toFixed(2) ?? t('common.na')}%</div>
              </div>
              <div className="p-3 bg-input rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{t('vaultModal.rewardApy')}</div>
                <div className="font-medium font-data mt-0.5">{selectedVault.analytics?.apy?.reward?.toFixed(2) ?? '0'}%</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{t('vaultModal.tokens')}</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedVault.underlyingTokens?.map(vt => (
                  <span key={vt.address} className="px-2.5 py-1 bg-secondary rounded-md text-xs font-semibold font-data">{vt.symbol}</span>
                ))}
              </div>
            </div>

            {selectedVault.tags && selectedVault.tags.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{t('vaultModal.tags')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedVault.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-[11px] font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <button className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              {t('vaultModal.depositButton')}
            </button>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
              {t('vaultModal.protectedNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
