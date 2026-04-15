'use client';

/**
 * Client-component wrapper that loads wallet/provider dependencies
 * client-side only via dynamic import with ssr: false.
 *
 * This keeps the Cloudflare Worker SSR bundle under the 3 MiB free-tier
 * limit by preventing wagmi + WalletConnect + RainbowKit (~1.5 MB) from
 * being included in the server function.
 */

import dynamic from 'next/dynamic';

const Providers = dynamic(
  () => import('./providers').then((m) => ({ default: m.Providers })),
  { ssr: false }
);

export function DynamicProviders({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
