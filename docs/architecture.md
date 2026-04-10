# SafeFlow EVM Architecture

## System Overview

SafeFlow is an on-chain fund management protocol for AI Agents. It enforces a strict separation between **human-controlled funds** and **AI-controlled execution**, ensuring an agent can never exceed its granted authority.

```text
┌──── User Interfaces ────────────────────────────────────────┐
│  Web Dashboard (Next.js)  │  Chat UI  │  CLI Tool           │
├──── AI Strategy Engine ─────────────────────────────────────┤
│  Natural language → vault analysis → execution plan          │
├──── LI.FI Integration ──────────────────────────────────────┤
│  Earn Data API (vault discovery, portfolio)                  │
│  Composer API  (quote + tx build)                            │
├──── SafeFlow EVM Contract ──────────────────────────────────┤
│  SafeFlowVault.sol                                           │
│  (wallets + session caps + execute deposit)                  │
├──── Audit Layer ────────────────────────────────────────────┤
│  Backend DB (reasoning payload) → IPFS extension             │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Model

The design enforces three invariants:

1. **Fund Isolation** — User deposits into a wallet on-chain; only the wallet owner can withdraw.
2. **Bounded Execution** — Agent operates through a `SessionCap` with per-interval rate limit, total spending cap, and expiry timestamp.
3. **Evidence Anchoring** — Every agent action is recorded with an `evidenceHash` on-chain, linking to the off-chain reasoning payload.

### Trust Boundaries

```text
Owner (human)                    Agent (AI)
  │                                 │
  ├── createWallet()                │
  ├── deposit(token, amount)        │
  ├── createSessionCap(agent, ...) ─┤
  ├── revokeSessionCap(capId)       │
  │                                 ├── executeDeposit(capId, ...)
  ├── withdraw(walletId, ...)       │       ↓
  │                                 │   [contract enforces limits]
  │                                 │       ↓
  │                                 │   DepositExecuted event
```

The agent **cannot**:
- Withdraw funds back to itself
- Modify its own spending limits
- Spend beyond per-interval or total cap
- Operate after session expiry or revocation
- Access wallets it wasn't granted a cap for

---

## Smart Contract: SafeFlowVault.sol

Single contract combining wallet management and session cap logic.

### Data Structures

```solidity
struct Wallet {
    address owner;
    bool exists;
}

struct SessionCap {
    uint256 walletId;
    address agent;
    uint64  maxSpendPerInterval;  // rate limit per time window
    uint256 maxSpendTotal;        // lifetime spending cap
    uint64  intervalSeconds;      // rate-limit window length
    uint64  expiresAt;            // unix timestamp
    uint256 totalSpent;           // cumulative spend
    uint64  lastSpendTime;        // last execution timestamp
    uint256 currentIntervalSpent; // spend in current interval
    bool    active;               // revocable
}
```

### State

- `wallets` — mapping(walletId => Wallet)
- `balances` — mapping(walletId => token => amount)
- `sessionCaps` — mapping(capId => SessionCap)
- Auto-incrementing `nextWalletId` and `nextCapId`

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createWallet()` | Anyone | Create a new wallet, caller becomes owner |
| `deposit(walletId, token, amount)` | Anyone | Deposit ERC-20 into wallet (requires prior approve) |
| `withdraw(walletId, token, amount)` | Owner | Withdraw tokens back to owner |
| `createSessionCap(...)` | Owner | Grant agent a spending cap |
| `revokeSessionCap(capId)` | Owner | Instantly revoke agent permission |
| `executeDeposit(...)` | Agent | Deposit into vault within cap bounds |
| `getBalance(walletId, token)` | View | Check wallet token balance |
| `getSessionCap(capId)` | View | Read cap configuration and state |
| `getRemainingAllowance(capId)` | View | Check remaining interval + total budget |

### executeDeposit Flow

```text
Agent calls executeDeposit(capId, token, amount, vault, evidenceHash, callData)
  │
  ├── 1. Validate: cap active, caller == cap.agent, not expired
  ├── 2. Check total limit: totalSpent + amount <= maxSpendTotal
  ├── 3. Check interval limit: reset if new window, then check
  ├── 4. Check wallet balance
  ├── 5. Update state: totalSpent, currentIntervalSpent, lastSpendTime, balance
  ├── 6. IERC20.approve(vault, amount) + vault.call(callData)
  └── 7. Emit DepositExecuted(walletId, capId, vault, token, amount, evidenceHash)
```

### Events

| Event | Fields |
|-------|--------|
| `WalletCreated` | owner (indexed), walletId (indexed) |
| `Deposited` | walletId (indexed), token (indexed), amount |
| `Withdrawn` | walletId (indexed), token (indexed), amount |
| `SessionCapCreated` | walletId, capId, agent (all indexed) + limits |
| `SessionCapRevoked` | capId (indexed) |
| `DepositExecuted` | walletId, capId, vault (indexed) + token, amount, evidenceHash |

### Errors

| Error | Trigger |
|-------|---------|
| `NotOwner()` | Non-owner attempts owner action |
| `SessionExpired()` | Cap past expiresAt |
| `ExceedsIntervalLimit()` | Amount exceeds per-interval cap |
| `ExceedsTotalLimit()` | Amount exceeds lifetime cap |
| `InsufficientBalance()` | Wallet lacks funds |
| `InvalidSessionCap()` | Wrong agent or invalid cap |
| `SessionCapNotActive()` | Cap was revoked |
| `TransferFailed()` | ERC-20 transfer reverted |
| `ZeroAmount()` | Zero amount passed |
| `ZeroAddress()` | Zero address passed |

### Key Difference vs Sui Version

| Aspect | Sui Move | Solidity |
|--------|----------|----------|
| Fund model | Coin/Balance objects | ERC-20 approve/transferFrom |
| SessionCap storage | Owned object (transferred to agent) | mapping + struct (contract-internal) |
| Rate limit | `max_spend_per_second` × elapsed time | `maxSpendPerInterval` with fixed window |
| Evidence pointer | `walrus_blob_id` (String) | `evidenceHash` (bytes32) |
| Wallet isolation | Separate shared objects | walletId mapping in single contract |

---

## LI.FI Integration

### Earn Data API (No Auth)

Base URL: `https://earn.li.fi`

| Endpoint | Description |
|----------|-------------|
| `GET /v1/earn/vaults` | List vaults, supports `chainId`, `limit`, `offset` |
| `GET /v1/earn/portfolio/{address}/positions` | Portfolio positions for a wallet |

Vault response fields used:
- `address`, `name`, `chainId`, `network`
- `protocol.name`
- `tags[]` — "stablecoin", "blue-chip", "lsd"
- `isTransactional` — whether deposit is supported
- `underlyingTokens[]` — symbol, decimals, address
- `analytics.apy.total`, `.base`, `.reward`
- `analytics.tvl.usd`

### Composer API (Requires API Key)

Base URL: `https://li.quest`

| Endpoint | Description |
|----------|-------------|
| `GET /v1/quote` | Build deposit/swap transaction |

Key params: `fromChain`, `toChain`, `fromToken`, `toToken`, `fromAddress`, `toAddress`, `fromAmount`.

The response `transactionRequest` is passed as `callData` to `executeDeposit()`.

---

## Audit Layer

### Purpose

Every AI agent decision must be recorded for transparency and auditability. The audit trail links on-chain execution to off-chain reasoning.

### Flow

```text
1. Agent decides to deposit into vault
2. POST /api/audit → records reasoning, returns evidenceHash
3. Agent calls executeDeposit(..., evidenceHash, ...)
4. On success: PATCH /api/audit → updates txHash, status
5. (Optional) Upload payload to IPFS, store CID
```

### Audit Entry Schema

```json
{
  "id": "uuid",
  "timestamp": 1712793600000,
  "agentAddress": "0x...",
  "action": "deposit",
  "vault": "0x...",
  "vaultName": "Aave USDC Base",
  "token": "USDC",
  "amount": "500000000",
  "reasoning": "Selected highest APY stablecoin vault on Base with TVL > $10M",
  "riskScore": 2,
  "evidenceHash": "0xsha256...",
  "txHash": "0x...",
  "ipfsCid": "Qm...",
  "status": "executed"
}
```

### Evidence Hash

`evidenceHash = SHA-256(JSON.stringify({ timestamp, agentAddress, action, vault, amount, reasoning }))`

This hash is passed to the contract and emitted in the `DepositExecuted` event, permanently anchoring the reasoning to the on-chain action.

---

## Frontend Architecture

### Pages and Tabs

| Tab | Component | Description |
|-----|-----------|-------------|
| Explore | `VaultExplorer` | Multi-chain vault discovery with filter/sort |
| AI Agent | `ChatAgent` | Natural language yield strategy chat |
| Portfolio | (placeholder) | LI.FI portfolio API integration |
| Settings | (inline) | SessionCap creation and management |

### Key Libraries

- **wagmi v2** — React hooks for Ethereum
- **RainbowKit** — Wallet connection modal
- **Lucide React** — Icon library
- **TailwindCSS** — Utility-first styling

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/agent/chat` | POST | AI chat with intent parsing + Earn API |
| `/api/audit` | GET | List audit entries |
| `/api/audit` | POST | Create audit entry |
| `/api/audit` | PATCH | Update entry (txHash, status) |

### AI Chat Intent Parser

The chat API route implements a rule-based intent parser (no LLM dependency for MVP):

- **search_vaults** — "find vaults", "best APY", "stablecoin on base"
- **deposit** — "deposit 500 USDC", "invest into..."
- **portfolio** — "my positions", "portfolio"
- **general** — Fallback with help suggestions

Parsed intents extract: chain, token symbol, tag, min APY, result limit, amount.

---

## CLI Architecture

`cli/src/index.ts` using Commander.js + chalk.

| Command | Description |
|---------|-------------|
| `safeflow vault list` | List vaults with `--chain`, `--token`, `--min-apy`, `--sort`, `--limit` |
| `safeflow info <address>` | Show vault details |
| `safeflow portfolio <address>` | Show portfolio positions |

All commands call LI.FI Earn API directly with `fetch()`.

---

## Supported Chains

| Chain | ID | Status |
|-------|----|--------|
| Base | 8453 | Primary target |
| Base Sepolia | 84532 | Testnet |
| Arbitrum | 42161 | Supported |
| Arbitrum Sepolia | 421614 | Testnet |
| Ethereum | 1 | Supported |
| Optimism | 10 | Supported |
| Polygon | 137 | Supported |
| BSC | 56 | Supported |
| Avalanche | 43114 | Supported |

---

## Environment Variables

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # WalletConnect Cloud
NEXT_PUBLIC_SAFEFLOW_CONTRACT=          # Deployed SafeFlowVault address
NEXT_PUBLIC_CHAIN_ID=8453               # Default chain
LIFI_API_KEY=                           # LI.FI Composer API key
OPENAI_API_KEY=                         # OpenAI (optional for MVP)
```
