# Minr.online

Minr.online is a Bitcoin lottery pool mining platform.  
**Like a lottery - if someone solves a block, we split the BTC payout.**

Users pay a $1 USD entry fee, run a browser miner or connect external miners,  
and if a block is found, rewards are distributed via a Supabase-driven payout policy.

This repository contains:

- **Frontend** (Next.js + Supabase) - Browser-based mining UI with analytics
- **Backend API** (Node + Express + Supabase) - REST API, WebSocket → Stratum bridge, payment gateway
- **Stratum Proxy** (Go TCP proxy) - Future Stratum proxy service
- **Supabase schema** - Database schema, migrations, and email templates
- **Infrastructure configs** - NGINX, systemd service files
- **Admin Panel** - Site settings, branding, image library
- **Payment Gateway** - Bitcoin payment system for $1 USD entry fee
- **Desktop Miner** - Pre-configured Python miner script

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
├── backend/                    # Node.js + TypeScript + Express API
│   ├── src/
│   │   ├── routes/            # API routes (profile, payments, admin, analytics)
│   │   ├── services/          # Background services (payment verifier, pool stats)
│   │   ├── utils/             # Utilities (Bitcoin API, image upload, miner script generator)
│   │   ├── middleware/        # Auth middleware
│   │   └── ws/               # WebSocket → Stratum bridge
├── frontend/                  # Next.js App Router + Tailwind CSS
│   ├── app/                  # Pages (miner, payment, admin)
│   └── components/           # React components (PaymentGate, AnalyticsDashboard, etc.)
├── stratum-proxy/            # Go Stratum proxy (placeholder)
├── supabase/                 # Database schema and email templates
│   ├── migrations/          # SQL migrations
│   ├── storage/            # Storage bucket configs
│   └── email-templates/    # HTML email templates
├── miner-scripts/           # Desktop miner scripts
├── docs/                    # Documentation
├── infra/                   # Infrastructure configs (nginx, systemd)
└── README.md               # This file
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

**Main pages:**
- `/` - Homepage with login/dashboard
- `/miner` - Browser-based miner UI (requires payment)
- `/payment` - Payment gateway for $1 USD entry fee
- `/admin` - Admin panel (admin only)

### Supabase Schema

Deploy the schema from `supabase/schema.sql` via Supabase CLI or dashboard.

Run migrations in order:
1. `supabase/migrations/add_payment_tables.sql`
2. `supabase/migrations/add_analytics_tables.sql`
3. `supabase/migrations/add_site_settings.sql`
4. `supabase/storage/bucket-config.sql` (create `site-assets` bucket first)

### Environment Variables

See `docs/environment-variables.md` for complete configuration guide.

**Backend** (`.env`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRATUM_UPSTREAM`, `BTC_MINING_USERNAME`, `BTC_MINING_PASSWORD`
- `BLOCKSTREAM_API_URL` or `BLOCKCYPHER_API_KEY`
- `ADMIN_EMAIL`, `ENTRY_FEE_USD`, `PAYMENT_EXPIRY_HOURS`

**Frontend** (`.env`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`

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

## Features

### Payment Gateway
- $1 USD entry fee paid in Bitcoin
- Automatic payment verification via blockchain APIs
- QR code generation for easy payment
- Payment status tracking and expiration handling
- See `docs/payment-setup.md` for details

### Admin Panel
- Manage Bitcoin wallet address
- Upload and manage site branding (favicon, logo, OG images)
- Configure hero section and navigation
- View all payments and manually verify if needed
- Access at `/admin` (admin email: `senecaone4@gmail.com`)

### Analytics
- User-specific mining statistics (hashrate, shares, earnings)
- Pool-wide statistics (total hashrate, active miners, difficulty)
- Chart visualizations (hashrate over time, shares, earnings)
- Session tracking and share submission history
- CSV export functionality

### External Miner Support
- Connect cpuminer, cgminer, bfgminer, or any Stratum-compatible miner
- Pre-configured desktop miner script (downloadable after payment)
- See `docs/external-miners.md` for connection details

### Email Templates
- Branded HTML email templates for Supabase auth
- Custom SMTP support (configured for `noreply@minr.online`)
- See `docs/smtp-config.md` and `supabase/email-templates/README.md`

## Documentation

- `docs/environment-variables.md` - Environment variable reference
- `docs/payment-setup.md` - Payment gateway configuration
- `docs/external-miners.md` - External miner connection guide
- `docs/smtp-config.md` - SMTP and email template setup

## Background Services

The backend runs two background services:

1. **Payment Verifier** - Checks blockchain for pending payments every 30 seconds
2. **Pool Stats Aggregator** - Updates pool statistics every 60 seconds

Both services start automatically with the backend server.
