# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeFlow EVM is an AI-powered DeFi yield management protocol with on-chain security guardrails. Users interact via natural language chat, and an AI agent discovers optimal yield vaults, builds deposit transactions, and executes them — all constrained by Solidity `SessionCap` contracts that enforce spending limits, expiry, and rate limits.

Built for DeFi Mullet Hackathon #1 — Track 2: AI × Earn.

## Commands

### Contracts (Foundry)

```bash
cd contracts
forge build                    # Compile Solidity
forge test                     # Run all tests
forge test -vvv                # Verbose test output with traces
forge test --match-test testName  # Run a single test
forge fmt                      # Format Solidity code
forge script script/Deploy.s.sol --rpc-url base_sepolia  # Simulate deploy
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast  # Deploy
```

### Web App (Next.js)

```bash
cd web
npm install
cp .env.example .env.local     # Then add API keys
npm run dev                    # Dev server
npm run build                  # Production build
npm run lint                   # ESLint
```

## Architecture

```
User (Chat / Dashboard)
  → AI Strategy Engine (LLM — OpenAI or Anthropic, configured via LLM_PROVIDER env)
    → LI.FI Earn API (vault discovery) + Composer (tx execution)
      → SafeFlowVault contract (SessionCap-enforced deposits)
        → Audit Layer (JSON file → IPFS)
```

### Contracts (`contracts/`)

- **SafeFlowVault.sol** — Core contract. Manages wallets (deposit/withdraw ERC-20) and SessionCaps (per-interval rate limits, total spending caps, expiry). Agents call `executeDeposit()` with LI.FI Composer calldata, bounded by their cap.
- **ISafeFlow.sol** — Events interface (`WalletCreated`, `SessionCapCreated`, `DepositExecuted`, etc.)
- Solidity 0.8.24, optimizer enabled (200 runs). Targets Base Sepolia and Arbitrum Sepolia testnets.
- Forge fmt: line_length=120, tab_width=4, bracket_spacing=true.

### Web App (`web/`)

Next.js 16 + React 19 + TailwindCSS 4 + wagmi v2 + RainbowKit. Single-page app with four tabs: AI Agent chat, Vault Explorer, Portfolio, Settings.

**Key modules:**

| File | Purpose |
|------|---------|
| `lib/llm.ts` | Unified LLM client — selects OpenAI or Anthropic via `LLM_PROVIDER` env. Falls back to rule-based parsing when no API key is set. |
| `lib/earn-api.ts` | LI.FI Earn API client — vault discovery with client-side filtering/sorting. |
| `lib/composer.ts` | LI.FI Composer client — builds cross-chain deposit quotes. |
| `lib/contracts.ts` | SafeFlowVault ABI + contract address resolution. |
| `types/index.ts` | Shared types: `EarnVault`, `ComposerQuote`, `AuditRecord`, `SessionCapInfo`, chain ID maps. |

**API routes:**

| Route | Purpose |
|-------|---------|
| `api/agent/chat/route.ts` | Chat endpoint — LLM-powered with rule-based fallback. LLM returns structured `<tool_callJSON>` blocks for search/deposit/portfolio actions. |
| `api/earn/vaults/route.ts` | Proxy to LI.FI Earn vaults API. |
| `api/earn/portfolio/[address]/route.ts` | Proxy to LI.FI Earn portfolio positions API. |
| `api/audit/route.ts` | Audit trail CRUD — stores entries as JSON in `data/audit.json`. |

**Components:**

- `ChatAgent.tsx` — AI chat interface with quick prompts, vault result cards, and loading states.
- `VaultExplorer.tsx` — Filterable/sortable vault table pulling from LI.FI Earn API.

**Wallet config** (`providers.tsx`): Chains are base, baseSepolia, arbitrum, arbitrumSepolia, mainnet.

### Environment Variables

Configured in `web/.env.example`. Key variables:
- `LLM_PROVIDER` — "openai" or "anthropic"
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — LLM provider keys
- `NEXT_PUBLIC_LIFI_API_KEY` — LI.FI API key
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID
- `NEXT_PUBLIC_SAFEFLOW_CONTRACT` — Deployed SafeFlowVault address

## Conventions

- The `web/AGENTS.md` warns that this Next.js version may have breaking changes from training data — check `node_modules/next/dist/docs/` before writing Next.js-specific code.
- Chat agent uses a custom `<tool_callJSON>` protocol for LLM tool use rather than native function calling.
- Audit trail is file-based (not a real database) — `data/audit.json` is gitignored.
