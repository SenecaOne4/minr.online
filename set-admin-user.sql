-- Set admin user in Supabase
-- Run this in Supabase SQL Editor, not in bash!

UPDATE profiles 
SET is_admin = TRUE 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'senecaone4@gmail.com'
);

-- Verify it worked:
SELECT p.id, p.is_admin, u.email 
FROM profiles p 
JOIN auth.users u ON p.id = u.id 
WHERE u.email = 'senecaone4@gmail.com';

