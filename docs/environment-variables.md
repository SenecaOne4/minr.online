# Environment Variables Documentation

This document describes all environment variables used in the Minr.online platform.

## Backend Environment Variables

### Server Configuration
- `PORT` - Port for the backend server (default: 3000)
- `NODE_ENV` - Environment mode: `development` or `production`

### Supabase Configuration
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)

### Stratum Pool Configuration
- `STRATUM_UPSTREAM` - Upstream Stratum pool address (format: `host:port`)
- `BTC_MINING_USERNAME` - Bitcoin address used for mining (admin wallet)
- `BTC_MINING_PASSWORD` - Mining password (usually 'x')

### Bitcoin Payment Configuration
- `BLOCKCYPHER_API_KEY` - BlockCypher API key (optional, if using BlockCypher)
- `BLOCKSTREAM_API_URL` - Blockstream API URL (default: `https://blockstream.info/api`, no key needed)
- `COINGECKO_API_URL` - CoinGecko API URL (default: `https://api.coingecko.com/api/v3`)
- `BITCOIN_NETWORK` - Bitcoin network: `mainnet` or `testnet` (default: `mainnet`)
- `PAYMENT_EXPIRY_HOURS` - Hours before payment request expires (default: 24)
- `ENTRY_FEE_USD` - Entry fee amount in USD (default: 1.00)
- `PAYMENT_CONFIRMATIONS` - Number of confirmations required (default: 1)

### Admin Configuration
- `ADMIN_EMAIL` - Admin user email address (default: `senecaone4@gmail.com`)

### Version Information
- `GIT_COMMIT_HASH` - Git commit hash for version endpoint (optional)

## Frontend Environment Variables

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)

### Site Configuration
- `NEXT_PUBLIC_SITE_URL` - Public site URL (for email redirects)
- `NEXT_PUBLIC_API_URL` - Backend API URL (empty for relative paths)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL for Stratum bridge

### Environment
- `NODE_ENV` - Environment mode: `development` or `production`

## Setup Instructions

1. Copy `.env.example` to `.env` in both `backend/` and `frontend/` directories
2. Fill in your actual values
3. Never commit `.env` files to version control
4. For production, set environment variables via your hosting platform or systemd service files

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Use `NEXT_PUBLIC_*` prefix only for variables that need to be accessible in the browser
- Keep API keys secure and rotate them regularly
- Use different keys for development and production environments

