# Fix Image Display Issues

## Problem
Images uploaded to Supabase storage are not displaying in the admin panel, even though:
- Storage bucket `site-assets` is marked as public
- URLs are being generated correctly
- Console shows both "Failed to load" and "Successfully loaded" messages

## Root Cause
Likely a CORS (Cross-Origin Resource Sharing) issue. Supabase storage buckets need explicit CORS configuration to allow images to be loaded from your domain.

## Solution

### 1. Configure CORS in Supabase Dashboard

1. Go to Supabase Dashboard → Storage → site-assets
2. Click on "Settings" or "Policies"
3. Add CORS configuration:
   - **Allowed Origins**: `https://minr.online`, `https://www.minr.online`, `http://localhost:3001` (for local dev)
   - **Allowed Methods**: `GET`, `HEAD`
   - **Allowed Headers**: `*`
   - **Exposed Headers**: `*`
   - **Max Age**: `3600`

### 2. Verify RLS Policies

Ensure the bucket has a public read policy:

```sql
-- Allow public read access to site-assets bucket
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'site-assets');
```

### 3. Test Image URLs Directly

Copy an image URL from the console and test it directly in a browser:
- If it loads in a new tab → CORS issue
- If it doesn't load → File doesn't exist or bucket not public

### 4. Check Browser Console

Look for CORS errors like:
- `Access to image at '...' from origin '...' has been blocked by CORS policy`
- `No 'Access-Control-Allow-Origin' header is present`

## Alternative: Use Supabase CDN

If CORS continues to be an issue, consider using Supabase's CDN URLs or proxying images through your backend.

