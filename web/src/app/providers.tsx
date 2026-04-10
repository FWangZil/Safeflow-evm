'use client';

import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, baseSepolia, arbitrum, arbitrumSepolia, mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { I18nProvider } from '@/i18n';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: 'SafeFlow Yield Agent',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [base, baseSepolia, arbitrum, arbitrumSepolia, mainnet],
  ssr: true,
});

const queryClient = new QueryClient();

const lightKitTheme = lightTheme({ accentColor: '#6366f1', borderRadius: 'medium' });
const darkKitTheme = darkTheme({ accentColor: '#6366f1', borderRadius: 'medium' });

function ThemedRainbowKit({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <RainbowKitProvider theme={resolvedTheme === 'light' ? lightKitTheme : darkKitTheme}>
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <ThemedRainbowKit>
              {children}
            </ThemedRainbowKit>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
