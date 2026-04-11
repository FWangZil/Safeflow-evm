# SafeFlow EVM — Hackathon Submission

> DeFi Mullet Hackathon #1 | Track 2: AI x Earn
> Team: SafeFlow

---

## Tweet Thread

**Tweet 1:**

Excited to submit SafeFlow EVM for DeFi Mullet Hackathon #1! 🎯

An AI-powered DeFi yield agent with on-chain security guardrails — chat naturally, earn safely.

Track: AI x Earn

Demo video: [LINK]
GitHub: https://github.com/brucexu-eth/safeflow-evm

@lifiprotocol @brucexu_eth

**Tweet 2:**

How it works:

1. Tell our AI agent your yield strategy in plain language
2. It queries @lifiprotocol Earn Data API to find the best vaults
3. Builds deposit tx via LI.FI Composer API
4. Executes through SafeFlowVault with SessionCap spending limits

On-chain security. Zero trust assumed.

**Tweet 3:**

Key features:

- Natural language yield strategy input (Chinese + English)
- Real-time vault discovery across chains via LI.FI Earn API
- Per-session spending caps enforced on-chain
- Full audit trail with evidence hashing
- Polished UI with light/dark mode and i18n

Built with Solidity + Next.js 16 + Foundry

---

## Project Write-Up

### What does the project do?

SafeFlow EVM is an AI-powered DeFi yield management agent that lets users discover and access yield opportunities through natural language conversation, while maintaining strict on-chain security guardrails.

Users interact with an AI chat agent (supporting Chinese and English), describing their yield preferences in plain language — e.g., "Find me the safest stablecoin yield on Ethereum" or "What's the best ETH staking APY?". The agent:

1. **Understands intent**: Parses the user's natural language request to identify risk preferences, asset types, chains, and strategy goals.
2. **Discovers vaults**: Queries the LI.FI Earn Data API to find matching vault opportunities across multiple chains and protocols.
3. **Presents options**: Shows curated vault recommendations with APY, TVL, and risk tags directly in the chat interface.
4. **Builds transactions**: Uses the LI.FI Composer API to construct cross-chain deposit transactions.
5. **Executes safely**: Routes all transactions through the SafeFlowVault smart contract, which enforces per-session spending caps on-chain.

The core innovation is the **SessionCap** system: users can authorize an AI agent to manage their funds within strictly bounded parameters — maximum spend per interval, maximum total spend, and automatic expiry — all enforced by immutable on-chain logic. This means the AI can act autonomously, but only within limits the user explicitly set.

### How does it use the Earn API?

SafeFlow EVM integrates LI.FI's Earn Data API as the primary vault discovery engine:

**Earn Data API (Vault Discovery)**
- Fetches yield vaults filtered by chain, asset type, and risk tags (stablecoin, blue-chip, LSD)
- Sorts vaults by APY or TVL to surface the best opportunities
- Retrieves detailed vault metadata: protocol name, underlying tokens, reward breakdown (base APY vs reward APY), and TVL
- Powers both the AI agent's contextual recommendations and the Vault Explorer's filterable table view

**Composer API (Transaction Building)**
- Builds deposit transactions for recommended vaults
- Handles cross-chain routing when the user's funds are on a different chain than the target vault
- Generates ready-to-sign transaction data that routes through SafeFlowVault for security

The AI agent combines both APIs into a seamless flow: natural language query → vault discovery via Earn Data API → transaction construction via Composer API → on-chain execution through SafeFlowVault with SessionCap enforcement.

### What's next?

1. **Multi-strategy automation**: Allow the AI agent to manage diversified positions across multiple vaults simultaneously, with portfolio-level rebalancing suggestions.

2. **Risk scoring integration**: Layer additional risk assessment data (protocol audit status, smart contract risk scores, impermanent loss estimates) onto vault recommendations.

3. **SessionCap governance**: Enable delegated spending caps where a DAO or multisig can set limits for sub-wallets, enabling institutional-grade yield management.

4. **Real-time monitoring**: Portfolio dashboard with P&L tracking, auto-compound suggestions, and alerts when vault APYs shift significantly.

5. **Mobile-first experience**: React Native companion app with push notifications for yield opportunities and spending cap alerts.

### API Feedback

**What worked well:**
- The Earn Data API's filtering parameters (chain ID, tags, sort options) are well-designed and map naturally to user intent — the AI can translate "safest stablecoin on Ethereum" directly into `chainId=1&tag=stablecoin&sortBy=apy`.
- Response structure is clean and comprehensive — having APY broken into base and reward components, plus TVL and protocol metadata, gives us everything needed for rich UI presentation.
- The Composer API's ability to build cross-chain transactions is powerful and eliminates the need for us to handle chain-hopping logic ourselves.

**Suggestions:**
- A `risk_score` or `risk_tier` field on vaults would help the AI agent make more nuanced recommendations — currently we rely on tags (stablecoin/blue-chip) as a proxy.
- Historical APY data (7d, 30d trend) would enable "APY is trending up/down" insights in chat responses.
- A `/vaults/search` endpoint accepting a free-text query could improve AI-driven discovery — the current filtering requires structured parameters that the AI must construct.

---

## Links

- **GitHub**: https://github.com/brucexu-eth/safeflow-evm
- **Demo Video**: [TO BE ADDED]
- **Google Form**: https://forms.gle/1PCvD9BymH1EyRmV8
- **Track**: AI x Earn (Track 2)
