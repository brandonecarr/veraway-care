-- Diagnostic SQL to identify what's blocking user deletion
-- Run this in Supabase SQL Editor to see what constraints are preventing deletion
-- User ID: e2ba1e23-2c88-434b-9205-2efd4b52f310
-- Email: devwithbrandon@gmail.com

-- Step 1: Check all foreign key constraints that reference the users table
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE confrelid = 'users'::regclass
  AND contype = 'f'
ORDER BY conrelid::regclass::text;

-- Step 2: Check what records reference this specific user
SELECT
  'issues (assigned_to)' AS reference_location,
  COUNT(*) AS record_count
FROM issues
WHERE assigned_to = 'e2ba1e23-2c88-434b-9205-2efd4b52f310'

UNION ALL

SELECT
  'issues (reported_by)' AS reference_location,
  COUNT(*) AS record_count
FROM issues
WHERE reported_by = 'e2ba1e23-2c88-434b-9205-2efd4b52f310'

UNION ALL

SELECT
  'user_roles' AS reference_location,
  COUNT(*) AS record_count
FROM user_roles
WHERE user_id = 'e2ba1e23-2c88-434b-9205-2efd4b52f310';

-- Step 3: Check if there are any other tables with user references
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name IN ('user_id', 'coordinator_id', 'clinician_id', 'assigned_to', 'reported_by', 'created_by', 'updated_by', 'owner_id')
    OR column_name LIKE '%_user_id'
  )
ORDER BY table_name, column_name;

-- Step 4: Check current constraint definitions
SELECT
  tc.table_name,
  kcu.column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_schema = 'public'
  AND tc.table_name IN ('issues', 'user_roles')
ORDER BY tc.table_name, kcu.column_name;
