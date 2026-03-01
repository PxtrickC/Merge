<p align="center">
    <img src="./.readme/0cc175b9c0f1b6a831c399e269772661.webp"/>
</p>

# Live

### [merge.ppatrick.xyz](https://merge.ppatrick.xyz/)

# Intro

Dashboard for [Merge by Pak](https://niftygateway.com/collections/pakmerge) — a game of extinction where 28,990 NFTs merge into fewer, more massive tokens over time.

Features:
- Real-time supply & merge tracking (on-chain data via Alchemy + Etherscan)
- ECharts statistics: supply curve, merge rate, tier survival, alpha mass growth, mass concentration
- Token lookup with live on-chain queries
- OpenSea market listings with wallet integration (WalletConnect / Reown)
- Leaderboard rankings by mass & merge count
- PWA with push notifications for new merges
- Mobile-first responsive design

# Stack

- **Nuxt 3** — SPA mode, static data + on-chain queries
- **Tailwind CSS** — responsive design
- **ECharts** — interactive statistical charts
- **ethers.js** — on-chain contract reads
- **Reown AppKit** — wallet connection (WalletConnect)
- **Upstash Redis** — server-side caching (OpenSea API)

# Data Pipeline

```
Etherscan (events) + Alchemy (contract reads)
        ↓
  build-db.mjs          → public/data/db.json (all token data)
  build-supply-history   → public/data/supply_history.json (daily snapshots)
  sync-matter.mjs        → public/data/matter_tokens.json
        ↓
  watch.mjs              → WebSocket listener, real-time updates
  update-db.mjs          → incremental batch updates
```

# Setup

```bash
# install dependencies
npm install

# create .env with API keys
# ALCHEMY_API_KEY=...
# ETHERSCAN_API_KEY=...

# build data files
npm run build:db
npm run build:history

# dev server
npm run dev

# build for production
npm run generate
```

# Scripts

| Command | Description |
|---|---|
| `npm run build:db` | Full rebuild of db.json from on-chain data |
| `npm run retry:burned` | Retry failed burned token queries |
| `npm run build:history` | Build supply_history.json from Etherscan events |
| `npm run update:db` | Incremental update of db.json + supply_history.json |
| `npm run sync:matter` | Sync Matter token data |
| `npm run watch` | Real-time WebSocket listener for new merges |
