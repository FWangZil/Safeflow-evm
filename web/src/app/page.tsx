'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, TrendingUp, MessageSquare, BarChart3, Settings, ExternalLink } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">{t('app.title')}</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">{t('app.subtitle')}</p>
              </div>
            </div>

            <nav className="hidden sm:flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <LangToggle />
              <ThemeToggle />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
                  const connected = mounted && account && chain;
                  return (
                    <div>
                      {!connected ? (
                        <button
                          onClick={openConnectModal}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          {t('nav.connectWallet')}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={openChainModal}
                            className="px-2.5 py-1.5 bg-secondary rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors"
                          >
                            {chain.name}
                          </button>
                          <button
                            onClick={openAccountModal}
                            className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors font-mono"
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
      <div className="sm:hidden flex border-b border-border bg-card/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto w-full">
            <ChatAgent onSelectVault={handleSelectVault} />
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{t('explore.title')}</h2>
              <p className="text-muted-foreground mt-1">
                {t('explore.subtitle')}
              </p>
            </div>
            <VaultExplorer onSelectVault={handleSelectVault} />
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{t('portfolio.title')}</h2>
              <p className="text-muted-foreground mt-1">
                {t('portfolio.subtitle')}
              </p>
            </div>
            <div className="p-8 border border-border rounded-lg bg-card text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('portfolio.connectPrompt')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('portfolio.dataSource')}</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
              <p className="text-muted-foreground mt-1">
                {t('settings.subtitle')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-5 border border-border rounded-lg bg-card space-y-3">
                <h3 className="font-medium">{t('settings.spendingLimits')}</h3>
                <div className="space-y-2">
                  <label className="block text-sm text-muted-foreground">{t('settings.maxPerInterval')}</label>
                  <input
                    type="text"
                    placeholder="1000 USDC"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-muted-foreground">{t('settings.maxTotal')}</label>
                  <input
                    type="text"
                    placeholder="5000 USDC"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-muted-foreground">{t('settings.intervalSeconds')}</label>
                  <input
                    type="text"
                    placeholder="3600"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="p-5 border border-border rounded-lg bg-card space-y-3">
                <h3 className="font-medium">{t('settings.agentConfig')}</h3>
                <div className="space-y-2">
                  <label className="block text-sm text-muted-foreground">{t('settings.agentAddress')}</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-muted-foreground">{t('settings.expiry')}</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <button className="w-full mt-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  {t('settings.createSessionCap')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('footer.left')}</span>
          <span>{t('footer.right')}</span>
        </div>
      </footer>

      {/* Vault Detail Modal */}
      {selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedVault(null)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedVault.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedVault.protocol?.name} • {selectedVault.network}</p>
              </div>
              <button onClick={() => setSelectedVault(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-background rounded-lg">
                <div className="text-xs text-muted-foreground">{t('vaultModal.totalApy')}</div>
                <div className="text-lg font-bold text-success">{selectedVault.analytics?.apy?.total?.toFixed(2) ?? t('common.na')}%</div>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <div className="text-xs text-muted-foreground">{t('vaultModal.tvl')}</div>
                <div className="text-lg font-bold">
                  {selectedVault.analytics?.tvl?.usd ? `$${(Number(selectedVault.analytics.tvl.usd) / 1e6).toFixed(2)}M` : t('common.na')}
                </div>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <div className="text-xs text-muted-foreground">{t('vaultModal.baseApy')}</div>
                <div className="font-medium">{selectedVault.analytics?.apy?.base?.toFixed(2) ?? t('common.na')}%</div>
              </div>
              <div className="p-3 bg-background rounded-lg">
                <div className="text-xs text-muted-foreground">{t('vaultModal.rewardApy')}</div>
                <div className="font-medium">{selectedVault.analytics?.apy?.reward?.toFixed(2) ?? '0'}%</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1.5">{t('vaultModal.tokens')}</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedVault.underlyingTokens?.map(vt => (
                  <span key={vt.address} className="px-2 py-1 bg-secondary rounded text-xs font-medium">{vt.symbol}</span>
                ))}
              </div>
            </div>

            {selectedVault.tags && selectedVault.tags.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1.5">{t('vaultModal.tags')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedVault.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <button className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
              {t('vaultModal.depositButton')}
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('vaultModal.protectedNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
