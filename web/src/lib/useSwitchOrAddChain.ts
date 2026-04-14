'use client';

import { useCallback, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import type { Chain } from 'viem';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getInjectedEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;

  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

function shouldTryAddChain(errorCode: number | string | undefined, errorMessage: string): boolean {
  return errorCode === 4902 || /unrecognized chain|unknown chain|not added/i.test(errorMessage);
}

function formatSwitchError(errorMessage: string): string {
  if (/user rejected|denied|cancelled|canceled/i.test(errorMessage)) {
    return 'Network switch was cancelled in your wallet.';
  }

  return errorMessage;
}

export function useSwitchOrAddChain(targetChain: Chain | undefined, targetChainId: number) {
  const [switchError, setSwitchError] = useState<string | null>(null);
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const clearSwitchError = useCallback(() => {
    setSwitchError(null);
  }, []);

  const switchOrAddChain = useCallback(async () => {
    if (!targetChain) {
      setSwitchError(`Unsupported execution chain ${targetChainId}.`);
      return;
    }

    setSwitchError(null);

    try {
      await switchChainAsync({ chainId: targetChain.id });
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: number | string }).code
        : undefined;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (shouldTryAddChain(errorCode, errorMessage)) {
        const provider = getInjectedEthereum();
        if (!provider) {
          setSwitchError('No wallet provider is available to add the target chain.');
          return;
        }

        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChain.id.toString(16)}`,
              chainName: targetChain.name,
              nativeCurrency: targetChain.nativeCurrency,
              rpcUrls: targetChain.rpcUrls.default.http,
              blockExplorerUrls: targetChain.blockExplorers?.default?.url
                ? [targetChain.blockExplorers.default.url]
                : undefined,
            }],
          });

          await switchChainAsync({ chainId: targetChain.id });
          return;
        } catch (addChainError) {
          const addChainMessage = addChainError instanceof Error ? addChainError.message : String(addChainError);
          setSwitchError(formatSwitchError(addChainMessage));
          return;
        }
      }

      setSwitchError(formatSwitchError(errorMessage));
    }
  }, [switchChainAsync, targetChain, targetChainId]);

  return {
    clearSwitchError,
    isSwitchingChain,
    switchError,
    switchOrAddChain,
  };
}