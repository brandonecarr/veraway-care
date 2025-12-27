-- Fix foreign key constraints to allow user deletion
-- When a user is deleted, set assigned_to to NULL instead of blocking deletion

-- First, clean up any orphaned records (issues referencing deleted users)
-- Set assigned_to to NULL for any issues where the user no longer exists
UPDATE issues
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM auth.users);

-- Set reported_by to NULL for any issues where the user no longer exists
UPDATE issues
SET reported_by = NULL
WHERE reported_by IS NOT NULL
  AND reported_by NOT IN (SELECT id FROM auth.users);

-- Set resolved_by to NULL for any issues where the user no longer exists
UPDATE issues
SET resolved_by = NULL
WHERE resolved_by IS NOT NULL
  AND resolved_by NOT IN (SELECT id FROM auth.users);

-- Now drop the existing foreign key constraints
ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_assigned_to_fkey;

ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_reported_by_fkey;

ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_resolved_by_fkey;

ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Recreate the constraints with proper ON DELETE behavior
-- IMPORTANT: Reference auth.users, not public.users
ALTER TABLE issues
ADD CONSTRAINT issues_assigned_to_fkey
FOREIGN KEY (assigned_to)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE issues
ADD CONSTRAINT issues_reported_by_fkey
FOREIGN KEY (reported_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE issues
ADD CONSTRAINT issues_resolved_by_fkey
FOREIGN KEY (resolved_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;

ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
