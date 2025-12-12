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
