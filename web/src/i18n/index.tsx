'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import en from '@/i18n/en.json';
import zh from '@/i18n/zh.json';

type Locale = 'en' | 'zh';

type TranslationMap = Record<string, unknown>;

const translations: Record<Locale, TranslationMap> = { en, zh };

const localeNames: Record<Locale, string> = { en: 'EN', zh: '中文' };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeName: string;
  alternateLocale: Locale;
  alternateLocaleName: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'safeflow-locale';

function getNestedValue(obj: TranslationMap, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'en' || stored === 'zh') {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(translations[locale], key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return value;
    },
    [locale],
  );

  const alternateLocale = locale === 'en' ? 'zh' : 'en';

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        localeName: localeNames[locale],
        alternateLocale,
        alternateLocaleName: localeNames[alternateLocale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
