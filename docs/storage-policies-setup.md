# Storage Policies Setup Guide

Since `storage.objects` is a system table, policies must be created via the Supabase Dashboard UI, not SQL.

## Step-by-Step Instructions

### 1. Access Storage Policies

1. Go to Supabase Dashboard → **Storage**
2. Click on the **`site-assets`** bucket (or create it if it doesn't exist)
3. Click on the **"Policies"** tab at the top

### 2. Create Public Read Policy

1. Click **"New Policy"** button
2. Select **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Public read access for site assets`
   - **Allowed operation**: `SELECT`
   - **Target roles**: Check both `anon` and `authenticated`
   - **Policy definition**: Paste this:
     ```sql
     bucket_id = 'site-assets'
     ```
4. Click **"Review"** then **"Save policy"**

### 3. Create Admin Insert Policy

1. Click **"New Policy"** again
2. Select **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Admin write access for site assets`
   - **Allowed operation**: `INSERT`
   - **Target roles**: Check `authenticated` only
   - **Policy definition**: Paste this:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

### 4. Create Admin Update Policy

1. Click **"New Policy"** again
2. Select **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Admin update access for site assets`
   - **Allowed operation**: `UPDATE`
   - **Target roles**: Check `authenticated` only
   - **Policy definition**: Paste this:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

### 5. Create Admin Delete Policy

1. Click **"New Policy"** again
2. Select **"Create a policy from scratch"**
3. Configure:
   - **Policy name**: `Admin delete access for site assets`
   - **Allowed operation**: `DELETE`
   - **Target roles**: Check `authenticated` only
   - **Policy definition**: Paste this:
     ```sql
     bucket_id = 'site-assets' AND
     auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
     ```
4. Click **"Review"** then **"Save policy"**

## Verification

After creating all policies:
1. Try uploading an image via the admin panel
2. Verify public images are accessible (check image URLs)
3. Verify non-admin users cannot upload/delete

## Troubleshooting

**Policy not working?**
- Make sure bucket name is exactly `site-assets`
- Verify your email matches `senecaone4@gmail.com` exactly
- Check that you're logged in when testing
- Review policy syntax in the UI

**Can't see Policies tab?**
- Make sure you're clicking on the bucket name, not just viewing the file list
- Check you have admin access to the project

