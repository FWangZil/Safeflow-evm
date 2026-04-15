'use client';
/**
 * Thin client component shell — no direct wallet/web3 imports.
 * The actual app (wagmi/RainbowKit UI) loads client-side only via
 * dynamic({ ssr: false }), keeping the CF Worker bundle small.
 * serverExternalPackages in next.config.ts excludes wagmi/viem/etc
 * from the server function; they are only loaded from static assets.
 */
import dynamic from 'next/dynamic';

const PageApp = dynamic(() => import('./page-client'), { ssr: false });

export default function Page() {
  return <PageApp />;
}
