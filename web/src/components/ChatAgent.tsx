'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Loader2, ArrowRight, Zap, TrendingUp, Shield } from 'lucide-react';
import type { ChatMessage, EarnVault } from '@/types';
import { formatApy, formatTvl } from '@/lib/earn-api';
import { useTranslation } from '@/i18n';

interface ChatAgentProps {
  onSelectVault?: (vault: EarnVault) => void;
}

export default function ChatAgent({ onSelectVault }: ChatAgentProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const QUICK_PROMPTS = [
    { icon: <TrendingUp className="w-3.5 h-3.5" />, text: t('chat.quickPrompts.stablecoin') },
    { icon: <Zap className="w-3.5 h-3.5" />, text: t('chat.quickPrompts.eth') },
    { icon: <Shield className="w-3.5 h-3.5" />, text: t('chat.quickPrompts.safe') },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: messages.slice(-10) }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
        vaults: data.vaults,
        action: data.action,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `${t('chat.errorPrefix')} ${err instanceof Error ? err.message : t('chat.errorRetry')}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, messages, t]);

  const handleSend = () => sendMessage(input);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] border border-border rounded-xl bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-gradient-to-r from-card to-card/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center ring-1 ring-primary/10">
          <Bot className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{t('chat.headerTitle')}</div>
          <div className="text-xs text-muted-foreground">{t('chat.headerSubtitle')}</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-500 font-medium">{t('chat.online')}</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Empty state — welcome + quick prompts */
          <div className="flex flex-col items-center justify-center h-full px-6 py-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-5 ring-1 ring-primary/10">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1.5">{t('chat.welcomeTitle')}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8">
              {t('chat.welcomeSubtitle')}
            </p>
            <div className="w-full max-w-md space-y-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                >
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {prompt.icon}
                  </span>
                  <span className="flex-1 text-sm">{prompt.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="p-4 space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-primary/10'
                      : 'bg-gradient-to-br from-primary/20 to-purple-500/20'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-secondary/60 text-secondary-foreground rounded-tl-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {/* Vault cards */}
                  {msg.vaults && msg.vaults.length > 0 && (
                    <div className="grid gap-2">
                      {msg.vaults.map((vault, i) => (
                        <div
                          key={`${vault.address}-${i}`}
                          className="p-3.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 cursor-pointer transition-all group"
                          onClick={() => onSelectVault?.(vault)}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {vault.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {vault.protocol?.name} • {vault.network}
                              </div>
                              {vault.tags && vault.tags.length > 0 && (
                                <div className="flex gap-1 mt-1.5">
                                  {vault.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary font-medium">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-semibold text-emerald-500">
                                {formatApy(vault.analytics?.apy?.total)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                TVL {formatTvl(vault.analytics?.tvl?.usd)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground/50 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-secondary/60 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>{t('chat.analyzing')}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/80">
        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isEmpty ? t('chat.inputPlaceholder') : t('chat.inputFollowUp')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/60 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-muted-foreground/50">
          <Shield className="w-3 h-3" />
          <span>{t('chat.sessionCapNote')}</span>
        </div>
      </div>
    </div>
  );
}
