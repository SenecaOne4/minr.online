# Minr.online

Minr.online is a Bitcoin inverse-lottery mining platform.  
Users can log in, run a browser miner or real hardware miner,  
connect through our stratum proxy, and if a block is found,  
rewards are distributed via a Supabase-driven payout policy.

This repository contains:

- **Frontend** (Next.js + Supabase) - Browser-based mining UI
- **Backend API** (Node + Express + Supabase) - REST API and WebSocket → Stratum bridge
- **Stratum Proxy** (Go TCP proxy) - Future Stratum proxy service
- **Supabase schema** - Database schema and migrations
- **Infrastructure configs** - NGINX, systemd service files

## Architecture

```
Browser Client → WebSocket → Backend (WS Bridge) → TCP → Stratum Pool
Browser Client → HTTP → Backend API → Supabase
Next.js Frontend → HTTP → Backend API
Next.js Frontend → Auth → Supabase
```

## Project Structure

```
minr-online/
├── backend/          # Node.js + TypeScript + Express API
├── frontend/         # Next.js App Router + Tailwind CSS
├── stratum-proxy/    # Go Stratum proxy (placeholder)
├── supabase/         # Database schema
├── infra/            # Infrastructure configs (nginx, systemd)
└── README.md         # This file
```

## Getting Started

### Backend

```bash
cd backend
pnpm install
pnpm dev
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

**Main miner UI:** `/miner`

### Supabase Schema

Deploy the schema from `supabase/schema.sql` via Supabase CLI or dashboard.

## Deployment

See deployment instructions in `infra/` directory for production setup.

## Why Submits May Not Happen (Difficulty)

Browser-based mining has significant limitations compared to dedicated mining hardware:

- **Hashrate**: Browsers typically achieve 10-1000 H/s, while ASICs achieve TH/s (trillions)
- **Difficulty**: Most Stratum pools set difficulty ≥ 1000, which requires finding a hash with many leading zeros
- **Probability**: At difficulty 1000, a browser mining at 100 H/s has roughly a 1 in 10^6 chance per second of finding a share
- **Expected time**: At difficulty 10000, a browser might need days or weeks to find a single share

**Solutions:**

1. **Use a pool with low difficulty**: Some pools support `mining.suggest_difficulty` to request lower difficulty (e.g., 4-16)
2. **Run your own stratum coordinator**: Set up a custom Stratum server that accepts lower difficulty shares
3. **Multiple clients**: Use nonce stride settings to prevent overlap when running multiple browser miners

The miner UI includes:
- **Desired Difficulty** input: Request lower difficulty from pools that support `mining.suggest_difficulty`
- **Nonce Stride**: Prevents multiple clients from checking the same nonces
- **Warnings**: Alerts when difficulty is too high for browser mining
