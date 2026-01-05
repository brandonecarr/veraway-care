-- Fix: Drop ALL old triggers and functions that reference facility_id on issue_audit_log
-- The issue_audit_log.facility_id column was renamed to hospice_id

-- =====================================================
-- STEP 1: Drop ALL old triggers on issues table that might create audit entries
-- =====================================================
DROP TRIGGER IF EXISTS issues_audit_trigger ON public.issues;
DROP TRIGGER IF EXISTS issue_audit_trigger ON public.issues;
DROP TRIGGER IF EXISTS log_issue_creation ON public.issues;
DROP TRIGGER IF EXISTS create_issue_audit_entry_trigger ON public.issues;

-- =====================================================
-- STEP 2: Drop ALL old triggers on issue_audit_log table
-- =====================================================
DROP TRIGGER IF EXISTS set_audit_log_facility_id_trigger ON public.issue_audit_log;
DROP TRIGGER IF EXISTS set_audit_log_hospice_id_trigger ON public.issue_audit_log;
DROP TRIGGER IF EXISTS set_audit_log_organization_id_trigger ON public.issue_audit_log;

-- =====================================================
-- STEP 3: Drop ALL old functions that reference facility_id
-- =====================================================
DROP FUNCTION IF EXISTS public.set_audit_log_facility_id();
DROP FUNCTION IF EXISTS public.set_audit_log_organization_id();
DROP FUNCTION IF EXISTS public.create_issue_audit_entry_with_facility();
DROP FUNCTION IF EXISTS public.create_issue_audit_entry();
DROP FUNCTION IF EXISTS public.log_issue_creation();

-- =====================================================
-- STEP 4: Ensure the column is named hospice_id
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_audit_log' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE public.issue_audit_log RENAME COLUMN facility_id TO hospice_id;
    END IF;

    -- Add hospice_id column if it doesn't exist at all
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_audit_log' AND column_name = 'hospice_id'
    ) THEN
        ALTER TABLE public.issue_audit_log ADD COLUMN hospice_id uuid;
    END IF;
END $$;

-- =====================================================
-- STEP 5: Create new function to auto-populate hospice_id on issue_audit_log
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_audit_log_hospice_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hospice_id IS NULL THEN
        NEW.hospice_id := public.get_user_hospice_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new trigger on issue_audit_log
CREATE TRIGGER set_audit_log_hospice_id_trigger
BEFORE INSERT ON public.issue_audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_hospice_id();

-- =====================================================
-- STEP 6: Create new issue audit trigger function using hospice_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_issue_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, hospice_id)
        VALUES (
            NEW.id,
            COALESCE(current_user_id, NEW.reported_by),
            'created',
            jsonb_build_object('status', NEW.status, 'issue_type', NEW.issue_type),
            NEW.hospice_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status != OLD.status THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, hospice_id)
            VALUES (
                NEW.id,
                COALESCE(current_user_id, NEW.reported_by),
                'status_changed',
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
                NEW.hospice_id
            );
        END IF;
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, hospice_id)
            VALUES (
                NEW.id,
                COALESCE(current_user_id, NEW.reported_by),
                'assigned',
                jsonb_build_object('assigned_to', NEW.assigned_to),
                NEW.hospice_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on issues table
CREATE TRIGGER issues_audit_trigger
AFTER INSERT OR UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.create_issue_audit_entry();
