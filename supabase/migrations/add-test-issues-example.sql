-- This will only work after you have at least one user authenticated
-- To use: replace USER_ID_HERE with the actual user ID from auth.users after signing up

-- Sample issues for testing
-- Note: This is just example SQL, actual user_id needs to be replaced with real authenticated user

-- Example of how to add test issues (replace USER_ID_HERE with actual user ID):
-- INSERT INTO public.issues (patient_id, reported_by, assigned_to, issue_type, description, status, priority, tags)
-- VALUES
--   ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'USER_ID_HERE', 'USER_ID_HERE', 'Medication', 'Patient needs pain medication refill', 'open', 'high', ARRAY['urgent', 'pain-management']),
--   ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'USER_ID_HERE', NULL, 'Family Communication', 'Family requesting care meeting', 'open', 'normal', ARRAY['family']),
--   ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'USER_ID_HERE', 'USER_ID_HERE', 'Equipment', 'Hospital bed delivery scheduled for tomorrow', 'in_progress', 'normal', ARRAY['equipment', 'delivery']);

-- Instructions:
-- 1. Sign up/sign in to the application
-- 2. Get your user ID from the database or user profile
-- 3. Replace USER_ID_HERE in the SQL above
-- 4. Run the SQL in Supabase SQL editor
