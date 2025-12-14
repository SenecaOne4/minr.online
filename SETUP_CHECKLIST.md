# Minr.online Setup Checklist

## ✅ Completed Steps

1. ✅ **Dependencies Installed**
   - Backend: `pnpm install` completed
   - Frontend: `pnpm install` completed
   - All new packages (axios, multer, qrcode.react, recharts) installed

2. ✅ **Environment Variables Configured**
   - Backend `.env` updated with payment and admin settings
   - Frontend `.env` created with Supabase credentials
   - Both files ready for production

3. ✅ **Code Compilation**
   - Backend TypeScript compilation successful
   - All async/await issues fixed

## 🔄 Next Steps (In Order)

### Step 1: Database Migrations ✅ COMPLETED

**Using Supabase CLI (Recommended):**
```bash
# Already linked and migrations applied!
supabase migration list  # Verify all migrations applied
```

**Migrations Applied:**
- ✅ `20241211000000_base_schema.sql` - Base tables (profiles, memberships, etc.)
- ✅ `20241212000001_add_payment_tables.sql` - Payment system tables
- ✅ `20241212000002_add_analytics_tables.sql` - Mining analytics tables
- ✅ `20241212000003_add_site_settings.sql` - Site settings and admin config

**Storage Bucket** (via Supabase Dashboard)
- ✅ Bucket created: `site-assets`
- ⚠️ **Still need to:** Set up storage policies via UI (see `docs/storage-policies-setup.md`)

### Step 2: Configure SMTP (Optional but Recommended)

1. Go to Supabase Dashboard → Project Settings → Auth → SMTP Settings
2. Enable Custom SMTP
3. Configure:
   - Host: `mail.listigrepairs.com`
   - Port: `587`
   - Username: `noreply@minr.online`
   - Password: `Password123!`
   - Sender email: `noreply@minr.online`
   - Sender name: `Minr.online`

4. Update Email Templates:
   - Go to Authentication → Email Templates
   - Copy templates from `supabase/email-templates/` directory
   - Update each template (magic-link, signup-confirmation, password-reset, email-change)

### Step 3: Test Backend Locally

```bash
cd backend
pnpm dev
```

Should see:
- Server running on port 3000
- WebSocket server available
- Background services started

### Step 4: Test Frontend Locally

```bash
cd frontend
pnpm dev
```

Should see:
- Next.js dev server running
- Can access http://localhost:3000

### Step 5: Initial Admin Setup

1. Log in to the site (create account if needed)
2. Go to `/admin` (must be logged in as `senecaone4@gmail.com`)
3. Configure:
   - Bitcoin wallet address
   - Site branding (favicon, logo, OG images)
   - Hero section content

### Step 6: Test Payment Flow

1. Create a test account
2. Go to `/payment` or dashboard
3. Create payment request
4. Test with testnet Bitcoin (if `BITCOIN_NETWORK=testnet`)
5. Verify payment detection works

### Step 7: Deploy to Production

1. Build frontend: `cd frontend && pnpm build`
2. Build backend: `cd backend && pnpm build`
3. Deploy to server (see deployment scripts)
4. Update production environment variables
5. Restart services

## 📋 Verification Checklist

- [ ] Database migrations run successfully
- [ ] Storage bucket `site-assets` created
- [ ] SMTP configured (optional)
- [ ] Email templates updated
- [ ] Backend starts without errors
- [ ] Frontend builds and runs
- [ ] Admin panel accessible
- [ ] Payment gateway works
- [ ] Mining page requires payment
- [ ] Analytics display correctly
- [ ] External miner connection works

## 🐛 Troubleshooting

### Database Errors
- Check Supabase connection in `.env`
- Verify migrations run in correct order
- Check RLS policies if queries fail

### Payment Not Detected
- Verify `BLOCKSTREAM_API_URL` is correct
- Check payment verifier service is running
- Verify Bitcoin address format

### Admin Panel Not Accessible
- Check `ADMIN_EMAIL` matches your email
- Verify authentication is working
- Check browser console for errors

### Frontend Build Errors
- Run `pnpm install` again
- Clear `.next` folder: `rm -rf .next`
- Check TypeScript errors: `pnpm build`

## 📚 Documentation

- Environment Variables: `docs/environment-variables.md`
- Payment Setup: `docs/payment-setup.md`
- External Miners: `docs/external-miners.md`
- SMTP Config: `docs/smtp-config.md`

