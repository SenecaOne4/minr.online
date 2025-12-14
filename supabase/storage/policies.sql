-- RLS Policies for storage bucket
-- Note: These policies reference admin email check
-- In production, you may want to create a function to check admin status

-- Enable RLS on storage.objects (if not already enabled)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- The policies are defined in bucket-config.sql
-- This file is kept separate for clarity

