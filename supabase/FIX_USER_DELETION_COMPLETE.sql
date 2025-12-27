-- COMPREHENSIVE FIX for user deletion constraints
-- This script will allow users to be deleted from auth.users without foreign key violations
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Clean up orphaned records first
-- ============================================================================

-- Find and clean up issues with deleted users
UPDATE issues
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM auth.users);

UPDATE issues
SET reported_by = NULL
WHERE reported_by IS NOT NULL
  AND reported_by NOT IN (SELECT id FROM auth.users);

-- Delete orphaned user_roles (roles for users that no longer exist in auth)
DELETE FROM user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- ============================================================================
-- STEP 2: Drop ALL existing foreign key constraints
-- ============================================================================

-- Drop constraints on issues table
ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_assigned_to_fkey,
DROP CONSTRAINT IF EXISTS issues_reported_by_fkey,
DROP CONSTRAINT IF EXISTS issues_assigned_to_fkey1,
DROP CONSTRAINT IF EXISTS issues_reported_by_fkey1;

-- Drop constraints on user_roles table
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey1;

-- Drop any other potential constraints (check diagnostic results)
-- Add more DROP CONSTRAINT statements here if diagnostic shows other constraints

-- ============================================================================
-- STEP 3: Recreate constraints with proper ON DELETE behavior
-- ============================================================================

-- Issues table: Set references to NULL when user is deleted
ALTER TABLE issues
ADD CONSTRAINT issues_assigned_to_fkey
FOREIGN KEY (assigned_to)
REFERENCES auth.users(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE issues
ADD CONSTRAINT issues_reported_by_fkey
FOREIGN KEY (reported_by)
REFERENCES auth.users(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- User roles: Delete role when user is deleted
ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============================================================================
-- STEP 4: Verify the fix
-- ============================================================================

SELECT
  'Constraints updated successfully!' AS status,
  'You can now delete users from auth.users' AS message;

-- Show current constraint definitions
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule AS on_delete,
  rc.update_rule AS on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_schema = 'public'
  AND tc.table_name IN ('issues', 'user_roles')
ORDER BY tc.table_name, kcu.column_name;
