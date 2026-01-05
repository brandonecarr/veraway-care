-- Fix RLS policies to avoid infinite recursion
-- The previous migration created policies that reference the users table from within
-- a policy on the users table, causing infinite recursion.

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view users in their hospice" ON users;
DROP POLICY IF EXISTS "Users can view users in their facility" ON users;
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "Users can view users in same hospice" ON users;

-- Create a security definer function in public schema to get user's hospice_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_hospice_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hospice_id FROM users WHERE id = auth.uid()
$$;

-- Create proper policy for users table that doesn't cause recursion
-- Users can view their own record OR users in the same hospice
CREATE POLICY "Users can view own record" ON users
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can view users in same hospice" ON users
    FOR SELECT
    USING (hospice_id = public.get_user_hospice_id());

-- Fix policies on patients table
DROP POLICY IF EXISTS "Users can view patients in their hospice" ON patients;
DROP POLICY IF EXISTS "Users can view patients in their facility" ON patients;

DO $$
BEGIN
    CREATE POLICY "Users can view patients in their hospice" ON patients
        FOR SELECT
        USING (hospice_id = public.get_user_hospice_id());
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on issues table
DROP POLICY IF EXISTS "Users can view issues in their hospice" ON issues;
DROP POLICY IF EXISTS "Users can view issues in their facility" ON issues;

DO $$
BEGIN
    CREATE POLICY "Users can view issues in their hospice" ON issues
        FOR SELECT
        USING (hospice_id = public.get_user_hospice_id());
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on user_roles table if they reference facility_id
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles in their facility" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles in their hospice" ON user_roles;

DO $$
BEGIN
    CREATE POLICY "Users can view their own roles" ON user_roles
        FOR SELECT
        USING (user_id = auth.uid());

    CREATE POLICY "Users can view roles in their hospice" ON user_roles
        FOR SELECT
        USING (hospice_id = public.get_user_hospice_id());
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on handoffs table
DROP POLICY IF EXISTS "Users can view handoffs in their facility" ON handoffs;
DROP POLICY IF EXISTS "Users can view handoffs in their hospice" ON handoffs;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoffs') THEN
        CREATE POLICY "Users can view handoffs in their hospice" ON handoffs
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE users.id = auth.uid()
                    AND users.hospice_id = handoffs.hospice_id
                )
            );
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on conversations table
DROP POLICY IF EXISTS "Users can view conversations in their facility" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations in their hospice" ON conversations;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        CREATE POLICY "Users can view conversations in their hospice" ON conversations
            FOR SELECT
            USING (hospice_id = public.get_user_hospice_id());
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on idg_reviews table
DROP POLICY IF EXISTS "Users can view idg_reviews in their facility" ON idg_reviews;
DROP POLICY IF EXISTS "Users can view idg_reviews in their hospice" ON idg_reviews;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idg_reviews') THEN
        CREATE POLICY "Users can view idg_reviews in their hospice" ON idg_reviews
            FOR SELECT
            USING (hospice_id = public.get_user_hospice_id());
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Fix policies on idg_issue_status table
DROP POLICY IF EXISTS "Users can view idg_issue_status in their facility" ON idg_issue_status;
DROP POLICY IF EXISTS "Users can view idg_issue_status in their hospice" ON idg_issue_status;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idg_issue_status') THEN
        -- Rename column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'idg_issue_status' AND column_name = 'facility_id'
        ) THEN
            ALTER TABLE idg_issue_status RENAME COLUMN facility_id TO hospice_id;
        END IF;

        CREATE POLICY "Users can view idg_issue_status in their hospice" ON idg_issue_status
            FOR SELECT
            USING (hospice_id = public.get_user_hospice_id());
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;

-- Fix policies on issue_audit_log table
DROP POLICY IF EXISTS "Users can view audit_log in their facility" ON issue_audit_log;
DROP POLICY IF EXISTS "Users can view audit_log in their hospice" ON issue_audit_log;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_audit_log') THEN
        -- Rename column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'issue_audit_log' AND column_name = 'facility_id'
        ) THEN
            ALTER TABLE issue_audit_log RENAME COLUMN facility_id TO hospice_id;
        END IF;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;
