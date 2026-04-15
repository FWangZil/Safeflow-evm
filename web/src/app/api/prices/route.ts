import { NextRequest, NextResponse } from 'next/server';

// Tokens that are pegged 1:1 to USD — no Binance query needed
const STABLECOINS: Record<string, true> = {
  USDC: true, USDT: true, DAI: true, BUSD: true, FRAX: true,
  LUSD: true, USDBC: true, USDS: true, CRVUSD: true, PYUSD: true,
  USDPLUS: true, DOLA: true, EURS: true,
};

// Override: our symbol → Binance trading pair
const BINANCE_PAIR_MAP: Record<string, string> = {
  ETH: 'ETHUSDT',
  WETH: 'ETHUSDT',
  STETH: 'STETHUSDT',
  WSTETH: 'WSTETHUSDT',
  CBETH: 'CBETHUSDT',
  RETH: 'RETHUSDT',
  WBTC: 'WBTCUSDT',
  BTC: 'BTCUSDT',
  SOL: 'SOLUSDT',
  WSOL: 'SOLUSDT',
  MATIC: 'MATICUSDT',
  POL: 'POLUSDT',
  ARB: 'ARBUSDT',
  OP: 'OPUSDT',
  BASE: 'BASEUSDT',
  AVAX: 'AVAXUSDT',
  BNB: 'BNBUSDT',
  LINK: 'LINKUSDT',
  UNI: 'UNIUSDT',
  AAVE: 'AAVEUSDT',
  CRV: 'CRVUSDT',
  LDO: 'LDOUSDT',
  MKR: 'MKRUSDT',
  COMP: 'COMPUSDT',
  SNX: 'SNXUSDT',
  BAL: 'BALUSDT',
  PENDLE: 'PENDLEUSDT',
  MORPHO: 'MORPHOUSDT',
  EULER: 'EULERUSDT',
};

interface BinanceTicker {
  symbol: string;
  price: string;
}

export async function GET(req: NextRequest) {
  const rawSymbols = req.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = rawSymbols
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({});
  }

  const result: Record<string, number> = {};

  // Stablecoins — price is exactly 1
  const toQuery: Array<{ sym: string; pair: string }> = [];
  for (const sym of symbols) {
    if (STABLECOINS[sym]) {
      result[sym] = 1.0;
    } else {
      const pair = BINANCE_PAIR_MAP[sym] ?? `${sym}USDT`;
      toQuery.push({ sym, pair });
    }
  }

  // Deduplicate by Binance pair (e.g. ETH and WETH share ETHUSDT)
  const pairToSyms = new Map<string, string[]>();
  for (const { sym, pair } of toQuery) {
    const existing = pairToSyms.get(pair) ?? [];
    existing.push(sym);
    pairToSyms.set(pair, existing);
  }

  if (pairToSyms.size > 0) {
    const pairList = [...pairToSyms.keys()].map((p) => `"${p}"`).join(',');
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbols=[${pairList}]`,
        { next: { revalidate: 60 } } // cache 60 s edge-side
      );
      if (res.ok) {
        const data = (await res.json()) as BinanceTicker[];
        for (const { symbol: pair, price } of data) {
          const syms = pairToSyms.get(pair);
          if (syms) {
            const p = parseFloat(price);
            for (const sym of syms) {
              result[sym] = p;
            }
          }
        }
      }
    } catch {
      // Partial results — at least stablecoins are present
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
