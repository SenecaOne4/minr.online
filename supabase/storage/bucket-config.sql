-- Supabase Storage bucket configuration for site assets
-- 
-- IMPORTANT: Storage policies cannot be created via SQL for system tables.
-- You must configure policies via the Supabase Dashboard UI instead.
--
-- Follow these steps:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click on the 'site-assets' bucket
-- 3. Go to the "Policies" tab
-- 4. Create the following policies:

-- Policy 1: Public Read Access
-- Name: "Public read access for site assets"
-- Allowed operation: SELECT
-- Policy definition:
--   bucket_id = 'site-assets'
-- Target roles: anon, authenticated

-- Policy 2: Admin Insert Access  
-- Name: "Admin write access for site assets"
-- Allowed operation: INSERT
-- Policy definition:
--   bucket_id = 'site-assets' AND
--   auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
-- Target roles: authenticated

-- Policy 3: Admin Update Access
-- Name: "Admin update access for site assets"
-- Allowed operation: UPDATE
-- Policy definition:
--   bucket_id = 'site-assets' AND
--   auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
-- Target roles: authenticated

-- Policy 4: Admin Delete Access
-- Name: "Admin delete access for site assets"
-- Allowed operation: DELETE
-- Policy definition:
--   bucket_id = 'site-assets' AND
--   auth.jwt() ->> 'email' = 'senecaone4@gmail.com'
-- Target roles: authenticated

-- See docs/storage-policies-setup.md for detailed UI instructions

