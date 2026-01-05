-- Migration: Rename facilities to hospices
-- This migration renames the facilities table and all related columns to use "hospice" terminology

-- Rename the main facilities table to hospices
ALTER TABLE IF EXISTS facilities RENAME TO hospices;

-- Update foreign key column in users table
ALTER TABLE users RENAME COLUMN facility_id TO hospice_id;

-- Update foreign key column in user_roles table
ALTER TABLE user_roles RENAME COLUMN facility_id TO hospice_id;

-- Update foreign key column in issues table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issues' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE issues RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update foreign key column in patients table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE patients RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update foreign key column in audit_logs table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE audit_logs RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update foreign key column in handoffs table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'handoffs' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE handoffs RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update foreign key column in conversations table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE conversations RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update foreign key column in idg_reviews table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'idg_reviews' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE idg_reviews RENAME COLUMN facility_id TO hospice_id;
    END IF;
END $$;

-- Update constraint names if they exist
DO $$
BEGIN
    -- Try to rename the unique constraint on user_roles
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_roles_user_facility_unique'
    ) THEN
        ALTER TABLE user_roles RENAME CONSTRAINT user_roles_user_facility_unique TO user_roles_user_hospice_unique;
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Update comment on hospices table
COMMENT ON TABLE hospices IS 'Healthcare hospices (formerly facilities/organizations)';

-- Recreate any views that reference the old table name
-- Note: Views will need to be dropped and recreated if they exist

-- Update RLS policies that reference facility_id
-- This is done via the policy recreation in subsequent commands

-- Drop and recreate policies on users table
DROP POLICY IF EXISTS "Users can view users in their facility" ON users;
CREATE POLICY "Users can view users in their hospice" ON users
    FOR SELECT
    USING (
        hospice_id IN (
            SELECT hospice_id FROM users WHERE id = auth.uid()
        )
    );

-- Drop and recreate policies on patients table if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view patients in their facility" ON patients;
    CREATE POLICY "Users can view patients in their hospice" ON patients
        FOR SELECT
        USING (
            hospice_id IN (
                SELECT hospice_id FROM users WHERE id = auth.uid()
            )
        );
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop and recreate policies on issues table if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view issues in their facility" ON issues;
    CREATE POLICY "Users can view issues in their hospice" ON issues
        FOR SELECT
        USING (
            hospice_id IN (
                SELECT hospice_id FROM users WHERE id = auth.uid()
            )
        );
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;
