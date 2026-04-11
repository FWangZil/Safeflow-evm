# SafeFlow EVM — Demo Video Script

> Target length: 3-4 minutes
> Style: Screen recording with voiceover, natural pacing

---

## Opening (0:00 - 0:20)

**[Screen: Dark mode landing page, SafeFlow logo animates in]**

Voiceover:
> "What if managing DeFi yield was as easy as having a conversation? Meet SafeFlow EVM — an AI-powered yield agent that finds the best vault opportunities and keeps your funds safe with on-chain spending limits."

**[Screen: Quick pan across the four tabs — Chat, Explore, Portfolio, Settings]**

---

## Scene 1: AI Chat Agent (0:20 - 1:20)

**[Screen: Click on "AI Agent" tab, chat interface appears with welcome state]**

Voiceover:
> "Start by telling the AI what you want — in plain English or Chinese."

**[Screen: Type "Find me the best stablecoin yield on Ethereum" and hit send]**

Voiceover:
> "The agent understands your intent and queries the LI.FI Earn Data API to find matching vaults."

**[Screen: Show loading state with "Analyzing vault opportunities...", then results appear with vault cards showing APY and TVL]**

Voiceover:
> "Results come back with real APY data, TVL, protocol info, and risk tags. Everything you need to compare at a glance."

**[Screen: Hover over a vault card, click to open the detail modal]**

Voiceover:
> "Click any vault to see the full breakdown — base APY, reward APY, underlying tokens, and protocol details."

**[Screen: Close modal, switch language to Chinese using the language toggle in the header]**

Voiceover:
> "Full internationalization support — switch between English and Chinese instantly."

---

## Scene 2: Vault Explorer (1:20 - 2:00)

**[Screen: Click on "Explore" tab]**

Voiceover:
> "For a more hands-on approach, the Vault Explorer gives you a filterable table of all available vaults."

**[Screen: Type "USDC" in search, select Ethereum from chain dropdown, select "Stablecoin" tag]**

Voiceover:
> "Filter by chain, asset, or risk category. Sort by APY or TVL to find exactly what you're looking for."

**[Screen: Click the APY column header to toggle sort order]**

Voiceover:
> "All data comes live from the LI.FI Earn Data API, so you're always seeing current yields."

**[Screen: Click "Deposit" on a vault row, detail modal opens]**

Voiceover:
> "Click deposit on any vault to see the full details and proceed."

---

## Scene 3: On-Chain Security — SessionCap (2:00 - 2:50)

**[Screen: Click on "Settings" tab]**

Voiceover:
> "Here's what makes SafeFlow different — the SessionCap system."

**[Screen: Point camera at the spending limits panel — Max Per Interval, Max Total, Interval]**

Voiceover:
> "Before the AI can execute any transaction, you set strict spending limits — maximum spend per time interval, maximum total spend, and when the session expires."

**[Screen: Show the Agent Configuration panel — Agent Address, Expiry, Create Session Cap button]**

Voiceover:
> "These limits are enforced on-chain by the SafeFlowVault smart contract. Not by the AI. Not by our servers. By immutable smart contract logic."

**[Screen: Brief flash of the Solidity contract code — show the SessionCap struct and _enforceCap modifier]**

Voiceover:
> "The vault checks every transaction against the session cap before execution. If the limit is exceeded, the transaction reverts. Period."

---

## Scene 4: Architecture Walkthrough (2:50 - 3:30)

**[Screen: Show a simple architecture diagram or flow]**

Voiceover:
> "Here's how the pieces fit together."

> "You talk to the AI agent. The agent uses LI.FI's Earn Data API to discover vaults and the Composer API to build deposit transactions. Transactions are routed through SafeFlowVault, which enforces your SessionCap limits on-chain. An audit trail with evidence hashing records every action."

**[Screen: Show the terminal — run `forge test` to demonstrate passing tests]**

Voiceover:
> "The smart contract is built with Solidity 0.8.24 and Foundry, with comprehensive tests. The frontend is Next.js 16 with full light and dark mode support."

---

## Scene 5: Light Mode & Closing (3:30 - 3:50)

**[Screen: Click the theme toggle to switch to light mode, show the app in light theme]**

Voiceover:
> "SafeFlow works beautifully in both light and dark mode."

**[Screen: Switch back to dark mode, zoom out to show the full app]**

Voiceover:
> "SafeFlow EVM — AI-powered yield discovery, on-chain security, zero trust assumed. Built for the DeFi Mullet Hackathon, Track 2: AI x Earn."

**[Screen: Show GitHub repo URL and hackathon tags]**

> "Check us out on GitHub. Thanks for watching."

---

## Production Notes

### Setup before recording:
1. Clear browser data for fresh state
2. Set app to dark mode
3. Have wallet connected on testnet with some test ETH
4. Ensure the API routes are running and responding
5. Close unnecessary browser tabs

### Key moments to get right:
- The first AI response with vault cards (most impressive visual moment)
- Language toggle switch (quick but shows polish)
- Light/dark theme toggle (demonstrates completeness)
- Settings page SessionCap explanation (core differentiator)

### Recording tips:
- Use 1920x1080 or higher resolution
- Record at 30fps minimum
- Use system audio capture if showing any sound effects
- Keep mouse movements slow and deliberate
- Pause briefly after each click to let the audience register what happened

### If things go wrong:
- If API is slow, trim the wait in editing
- If wallet connection fails, pre-connect before recording
- Have a backup screenshot of the chat with pre-populated messages if live demo fails
