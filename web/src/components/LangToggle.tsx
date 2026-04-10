'use client';

import { useTranslation } from '@/i18n';
import { Languages } from 'lucide-react';

export default function LangToggle() {
  const { alternateLocale, setLocale } = useTranslation();

  return (
    <button
      onClick={() => setLocale(alternateLocale)}
      className="flex items-center gap-1 w-8 h-8 justify-center rounded-lg bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
      aria-label="Switch language"
    >
      <Languages className="w-3.5 h-3.5" />
    </button>
  );
}
