# Storage Policies Quick Setup Guide

Follow these exact steps to set up storage policies for the `site-assets` bucket.

## Step 1: Navigate to Storage Policies

1. Go to **Supabase Dashboard** → https://supabase.com/dashboard
2. Select your project: **minr.online** (byeokczfgepuecugaikj)
3. Click **"Storage"** in the left sidebar
4. Click on the bucket name **"site-assets"** (not just the folder icon)
5. Click the **"Policies"** tab at the top

## Step 2: Create Policy 1 - Public Read Access

1. Click **"New Policy"** button (top right)
2. Select **"Create a policy from scratch"**
3. Fill in:
   - **Policy name**: `Public read access for site assets`
   - **Allowed operation**: Select **`SELECT`** from dropdown
   - **Target roles**: Check both ☑️ `anon` and ☑️ `authenticated`
   - **Policy definition**: Paste this SQL:
     ```sql
     bucket_id = 'site-assets'
     ```
4. Click **"Review"** button
5. Click **"Save policy"** button

## Step 3: Create Policy 2 - Admin Insert (Upload)

1. Click **"New Policy"** button again
2. Select **"Create a policy from scratch"**
3. Fill in:
   - **Policy name**: `Admin write access for site assets`
   - **Allowed operation**: Select **`INSERT`** from dropdown
   - **Target roles**: Check only ☑️ `authenticated` (uncheck `anon`)
   - **Policy definition**: Paste this SQL:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

## Step 4: Create Policy 3 - Admin Update

1. Click **"New Policy"** button again
2. Select **"Create a policy from scratch"**
3. Fill in:
   - **Policy name**: `Admin update access for site assets`
   - **Allowed operation**: Select **"UPDATE"** from dropdown
   - **Target roles**: Check only ☑️ `authenticated`
   - **Policy definition**: Paste this SQL:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

## Step 5: Create Policy 4 - Admin Delete

1. Click **"New Policy"** button again
2. Select **"Create a policy from scratch"**
3. Fill in:
   - **Policy name**: `Admin delete access for site assets`
   - **Allowed operation**: Select **"DELETE"** from dropdown
   - **Target roles**: Check only ☑️ `authenticated`
   - **Policy definition**: Paste this SQL:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

## Verification

After creating all 4 policies, you should see:
- ✅ Public read access for site assets (SELECT, anon + authenticated)
- ✅ Admin write access for site assets (INSERT, authenticated only)
- ✅ Admin update access for site assets (UPDATE, authenticated only)
- ✅ Admin delete access for site assets (DELETE, authenticated only)

## Test It

1. Log in to your site as `senecaone4@gmail.com`
2. Go to `/admin` page
3. Try uploading an image in the "Branding" tab
4. If it works, policies are set up correctly! ✅

## Troubleshooting

**Can't see "Policies" tab?**
- Make sure you clicked on the bucket name itself (not just viewing files)
- The bucket should be named exactly `site-assets`

**Policy creation fails?**
- Check SQL syntax (copy exactly as shown)
- Make sure bucket_id matches exactly: `'site-assets'`
- Verify your email matches exactly: `'senecaone4@gmail.com'`

**Can't upload images?**
- Verify you're logged in as admin (`senecaone4@gmail.com`)
- Check all 4 policies were created
- Try refreshing the admin page

