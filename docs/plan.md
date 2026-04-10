# SafeFlow EVM × DeFi Mullet Hackathon Plan

## Overview

Rewrite SafeFlow's AI Agent secure authorization model in Solidity for EVM chains, combining it with LI.FI Earn API to build an AI-driven DeFi yield management system. Competing in **Track 2: AI × Earn**.

## Hackathon Info

- **Event**: DeFi Mullet Hackathon #1
- **Track**: Track 2 — AI × Earn
- **Submission**: April 14, APAC 09:00–12:00 UTC+8
- **Requirements**: Tweet with project name, demo video/link, GitHub, track name, @lifiprotocol @brucexu_eth
- **Registration**: <https://forms.gle/RFLGG8RiEKC3AqnQA>
- **Submission form**: <https://forms.gle/1PCvD9BymH1EyRmV8>
- **Composer API Key**: <https://portal.li.fi/>
- **Earn Data API**: `earn.li.fi` (no auth required)
- **Community**: Telegram <https://t.me/lifibuilders>

---

## Core Idea

User tells an AI Agent a yield strategy via natural language / CLI / Dashboard → Agent discovers vaults, builds plan, executes deposits → All operations constrained by on-chain SafeFlow contracts (spending limits, session expiry) → Decision evidence stored in backend DB + IPFS extension.

---

## Implementation Timeline (3 Days)

### Day 1 (Apr 11): Contracts + API Foundation

| # | Task | Status |
|---|------|--------|
| 1 | Create `safeflow-evm` monorepo, git init, .gitignore, README | ✅ Done |
| 2 | Foundry contracts: `SafeFlowVault.sol` + full test suite | ✅ Done (12/12 tests pass) |
| 3 | Next.js frontend scaffold: wagmi v2 + RainbowKit + Tailwind | ✅ Done |
| 4 | LI.FI Earn Data API client (`lib/earn-api.ts`) | ✅ Done |
| 5 | LI.FI Composer API client (`lib/composer.ts`) | ✅ Done |
| 6 | Vault Explorer UI component + page | ✅ Done |
| 7 | AI Chat Agent UI + API route | ✅ Done |
| 8 | Audit API (JSON file DB + evidence hash) | ✅ Done |
| 9 | Contract ABI integration (`lib/contracts.ts`) | ✅ Done |
| 10 | CLI tool: vault list / info / portfolio | ✅ Done |
| 11 | SafeFlow EVM Yield Agent Skill | ✅ Done |

### Day 2 (Apr 12): Integration + Polish

| # | Task | Status |
|---|------|--------|
| 12 | OpenAI API integration for smarter AI reasoning | Pending |
| 13 | wagmi hooks for contract interaction (deposit, createSessionCap) | Pending |
| 14 | Portfolio page with real LI.FI data | Pending |
| 15 | Settings page: create/revoke SessionCap on-chain | Pending |
| 16 | End-to-end flow: chat → vault select → deposit via contract | Pending |
| 17 | Base Sepolia testnet contract deployment | Pending |

### Day 3 (Apr 13): Demo + Submission Prep

| # | Task | Status |
|---|------|--------|
| 18 | E2E testing with testnet (small real funds) | Pending |
| 19 | UI polish, error handling, loading states | Pending |
| 20 | Record demo video | Pending |
| 21 | Deploy frontend (Vercel) | Pending |
| 22 | Write submission tweet + project description | Pending |

### Day 4 (Apr 14): Submit

| # | Task | Status |
|---|------|--------|
| 23 | Post tweet (APAC 09:00-12:00) | Pending |
| 24 | Fill submission form | Pending |

---

## Repository Structure

```
safeflow-evm/
├── contracts/              # Foundry Solidity contracts
│   ├── src/
│   │   ├── SafeFlowVault.sol
│   │   └── interfaces/ISafeFlow.sol
│   ├── test/
│   │   ├── SafeFlowVault.t.sol
│   │   └── mocks/MockERC20.sol
│   └── script/Deploy.s.sol
├── web/                    # Next.js frontend + API
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Main dashboard
│   │   │   ├── providers.tsx       # wagmi/RainbowKit
│   │   │   └── api/
│   │   │       ├── agent/chat/     # AI chat endpoint
│   │   │       └── audit/          # Audit CRUD API
│   │   ├── components/
│   │   │   ├── VaultExplorer.tsx
│   │   │   └── ChatAgent.tsx
│   │   ├── lib/
│   │   │   ├── earn-api.ts         # LI.FI Earn API client
│   │   │   ├── composer.ts         # LI.FI Composer client
│   │   │   └── contracts.ts        # ABI + address helper
│   │   └── types/index.ts
│   └── .env.example
├── cli/                    # CLI tool
│   └── src/index.ts
├── docs/                   # Documentation
└── README.md
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Solidity ^0.8.24 + Foundry |
| Target Chains | Base, Arbitrum (Sepolia testnet first) |
| Frontend | Next.js 16 + React 19 + TailwindCSS |
| Wallet | wagmi v2 + RainbowKit |
| AI Engine | OpenAI API (GPT-4o) |
| Yield API | LI.FI Earn Data API + Composer API |
| Audit Storage | JSON file DB (MVP) → SQLite → IPFS extension |
| CLI | Node.js + Commander.js + chalk |
| Skill System | Windsurf skill (`safeflow-evm-yield`) |
