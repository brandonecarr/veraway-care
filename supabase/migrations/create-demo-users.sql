-- Demo Users Setup
-- After running this migration, use these credentials to log in:
-- 
-- CLINICIAN:
-- Email: clinician@demo.com
-- Password: demo123456
--
-- COORDINATOR:
-- Email: coordinator@demo.com
-- Password: demo123456
--
-- AFTER-HOURS:
-- Email: afterhours@demo.com
-- Password: demo123456

-- Note: You need to manually create these users in Supabase Auth Dashboard
-- Then run this SQL to assign their roles:

-- Instructions:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" and create each user with the emails and passwords above
-- 3. Copy each user's ID
-- 4. Run the following SQL, replacing USER_ID_HERE with actual IDs:

-- Example (replace USER_IDs with actual UUIDs from auth.users):
-- INSERT INTO public.user_roles (user_id, role) VALUES
--   ('CLINICIAN_USER_ID', 'clinician'),
--   ('COORDINATOR_USER_ID', 'coordinator'),
--   ('AFTERHOURS_USER_ID', 'after_hours')
-- ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- To find user IDs after creating them:
-- SELECT id, email FROM auth.users WHERE email IN ('clinician@demo.com', 'coordinator@demo.com', 'afterhours@demo.com');
