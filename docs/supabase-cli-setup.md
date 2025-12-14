# Supabase CLI Setup Guide

Using the Supabase CLI makes it easy to run migrations and manage your database.

## Quick Setup

### 1. Link to Your Project

From your project root (`/Users/seneca/Desktop/minr.online`):

```bash
# Link to your Supabase project
supabase link --project-ref byeokczfgepuecugaikj
```

You'll be prompted to enter your database password. If you don't have it:
- Go to Supabase Dashboard → Project Settings → Database
- Click "Reset database password" if needed
- Or use the password you set when creating the project

### 2. Run Migrations

Once linked, run all migrations in order:

```bash
# Run all migrations
supabase db push

# Or run specific migration files
supabase migration up
```

### 3. Verify Migrations

Check that tables were created:

```bash
# List all tables
supabase db diff

# Or check in Supabase Dashboard → Table Editor
```

## Migration Files (Run in Order)

1. ✅ `add_payment_tables.sql` - Payment system tables
2. ✅ `add_analytics_tables.sql` - Mining analytics tables  
3. ✅ `add_site_settings.sql` - Site settings and admin config

## Alternative: Manual SQL Execution

If CLI doesn't work, you can still run migrations manually:

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of each migration file
3. Paste and run in order
4. Verify tables appear in Table Editor

## Useful CLI Commands

```bash
# Link to project
supabase link --project-ref byeokczfgepuecugaikj

# Push migrations
supabase db push

# Check database status
supabase status

# Generate TypeScript types
supabase gen types typescript --linked > types/supabase.ts

# Reset database (careful - deletes all data!)
supabase db reset
```

## Troubleshooting

**"Project not found"**
- Verify project ref: `byeokczfgepuecugaikj`
- Check you're logged in: `supabase login`

**"Database password required"**
- Get password from Supabase Dashboard → Project Settings → Database
- Or reset it if forgotten

**"Migration failed"**
- Check error message
- Verify previous migrations ran successfully
- Some migrations depend on others (run in order)

