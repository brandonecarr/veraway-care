-- Fix the missing resolved_by constraint that's blocking user deletion
-- Run this in Supabase SQL Editor

-- Step 1: Clean up any orphaned resolved_by references
UPDATE issues
SET resolved_by = NULL
WHERE resolved_by IS NOT NULL
  AND resolved_by NOT IN (SELECT id FROM auth.users);

-- Step 2: Drop the existing resolved_by constraint
ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_resolved_by_fkey;

-- Step 3: Recreate the constraint with ON DELETE SET NULL
ALTER TABLE issues
ADD CONSTRAINT issues_resolved_by_fkey
FOREIGN KEY (resolved_by)
REFERENCES auth.users(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 4: Verify the fix
SELECT
  'Fixed! You can now delete users.' AS status;

-- Show the updated constraint
SELECT
  table_name,
  column_name,
  delete_rule AS on_delete,
  update_rule AS on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_schema = 'public'
  AND tc.table_name = 'issues'
  AND kcu.column_name = 'resolved_by';
