'use client';

import { useTranslation } from '@/i18n';
import { Languages } from 'lucide-react';

export default function LangToggle() {
  const { alternateLocale, alternateLocaleName, setLocale } = useTranslation();

  return (
    <button
      onClick={() => setLocale(alternateLocale)}
      className="flex items-center gap-1.5 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-foreground text-xs font-medium"
      aria-label="Switch language"
    >
      <Languages className="w-3.5 h-3.5" />
      {alternateLocaleName}
    </button>
  );
}
