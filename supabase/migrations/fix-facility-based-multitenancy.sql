-- Fix Facility-Based Multi-Tenancy
-- This migration ensures all tables use facility_id (not organization_id)
-- and creates proper RLS policies for facility-based data isolation

-- =====================================================
-- STEP 1: Add missing name column to facilities table
-- =====================================================

ALTER TABLE public.facilities
ADD COLUMN IF NOT EXISTS name text;

-- Update any facilities that don't have a name (use slug as fallback)
UPDATE public.facilities
SET name = slug
WHERE name IS NULL;

-- Make name required going forward
ALTER TABLE public.facilities
ALTER COLUMN name SET NOT NULL;

-- =====================================================
-- STEP 2: Ensure facility_id exists in all tables
-- =====================================================

-- Users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS users_facility_id_idx ON public.users(facility_id);

-- Patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS patients_facility_id_idx ON public.patients(facility_id);

-- Issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issues_facility_id_idx ON public.issues(facility_id);

-- Issue messages table
ALTER TABLE public.issue_messages
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_messages_facility_id_idx ON public.issue_messages(facility_id);

-- Issue audit log table
ALTER TABLE public.issue_audit_log
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_audit_log_facility_id_idx ON public.issue_audit_log(facility_id);

-- Handoffs table
ALTER TABLE public.handoffs
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS handoffs_facility_id_idx ON public.handoffs(facility_id);

-- User roles table (should already have it, but just in case)
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_facility_id_idx ON public.user_roles(facility_id);

-- =====================================================
-- STEP 3: Create helper functions for facility-based access
-- =====================================================

-- Function to get current user's facility_id
CREATE OR REPLACE FUNCTION public.get_user_facility_id()
RETURNS uuid AS $$
DECLARE
    fac_id uuid;
BEGIN
    SELECT facility_id INTO fac_id
    FROM public.users
    WHERE id = auth.uid();

    RETURN fac_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to facility
CREATE OR REPLACE FUNCTION public.user_belongs_to_facility(fac_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND facility_id = fac_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: Drop old organization-based policies, triggers, and functions
-- =====================================================

-- Drop old organization-based RLS policies first (they depend on the functions)
DROP POLICY IF EXISTS "Users can view their organization" ON public.facilities;
DROP POLICY IF EXISTS "Users can update their organization" ON public.facilities;
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;
DROP POLICY IF EXISTS "Users can view organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can create organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can view organization issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can create organization issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can view organization audit log" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Users can view organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can create organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can update organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can delete organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can view organization roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert organization roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update organization roles" ON public.user_roles;

-- Drop old organization triggers
DROP TRIGGER IF EXISTS set_patient_organization_id_trigger ON public.patients;
DROP TRIGGER IF EXISTS set_issue_organization_id_trigger ON public.issues;
DROP TRIGGER IF EXISTS set_issue_message_organization_id_trigger ON public.issue_messages;
DROP TRIGGER IF EXISTS set_audit_log_organization_id_trigger ON public.issue_audit_log;
DROP TRIGGER IF EXISTS set_handoff_organization_id_trigger ON public.handoffs;

-- Drop old organization functions (now that policies are gone)
DROP FUNCTION IF EXISTS public.set_patient_organization_id();
DROP FUNCTION IF EXISTS public.set_issue_organization_id();
DROP FUNCTION IF EXISTS public.set_issue_message_organization_id();
DROP FUNCTION IF EXISTS public.set_audit_log_organization_id();
DROP FUNCTION IF EXISTS public.set_handoff_organization_id();
DROP FUNCTION IF EXISTS public.get_user_organization_id();
DROP FUNCTION IF EXISTS public.user_belongs_to_organization(uuid);

-- =====================================================
-- STEP 5: Update triggers to auto-populate facility_id
-- =====================================================

-- Trigger function to auto-populate facility_id on issues
CREATE OR REPLACE FUNCTION public.set_issue_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_facility_id_trigger ON public.issues;
CREATE TRIGGER set_issue_facility_id_trigger
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.set_issue_facility_id();

-- Trigger function to auto-populate facility_id on patients
CREATE OR REPLACE FUNCTION public.set_patient_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_patient_facility_id_trigger ON public.patients;
CREATE TRIGGER set_patient_facility_id_trigger
BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_facility_id();

-- Trigger function to auto-populate facility_id on issue_messages
CREATE OR REPLACE FUNCTION public.set_issue_message_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_message_facility_id_trigger ON public.issue_messages;
CREATE TRIGGER set_issue_message_facility_id_trigger
BEFORE INSERT ON public.issue_messages
FOR EACH ROW EXECUTE FUNCTION public.set_issue_message_facility_id();

-- Trigger function to auto-populate facility_id on issue_audit_log
CREATE OR REPLACE FUNCTION public.set_audit_log_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_audit_log_facility_id_trigger ON public.issue_audit_log;
CREATE TRIGGER set_audit_log_facility_id_trigger
BEFORE INSERT ON public.issue_audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_facility_id();

-- Trigger function to auto-populate facility_id on handoffs
CREATE OR REPLACE FUNCTION public.set_handoff_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_handoff_facility_id_trigger ON public.handoffs;
CREATE TRIGGER set_handoff_facility_id_trigger
BEFORE INSERT ON public.handoffs
FOR EACH ROW EXECUTE FUNCTION public.set_handoff_facility_id();

-- =====================================================
-- STEP 6: Update RLS policies for facility-based multi-tenancy
-- =====================================================

-- Enable RLS on facilities table
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Facilities policies
DROP POLICY IF EXISTS "Users can view their facility" ON public.facilities;
CREATE POLICY "Users can view their facility" ON public.facilities
FOR SELECT USING (
    id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can update their facility" ON public.facilities;
CREATE POLICY "Users can update their facility" ON public.facilities
FOR UPDATE USING (
    id = public.get_user_facility_id()
);

-- Users policies (allow viewing users in same facility)
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;
DROP POLICY IF EXISTS "Users can view facility members" ON public.users;
CREATE POLICY "Users can view facility members" ON public.users
FOR SELECT USING (
    facility_id = public.get_user_facility_id() OR
    id = auth.uid()
);

-- Patients policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view all patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view facility patients" ON public.patients;
CREATE POLICY "Users can view facility patients" ON public.patients
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert facility patients" ON public.patients;
CREATE POLICY "Users can insert facility patients" ON public.patients
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update facility patients" ON public.patients;
CREATE POLICY "Users can update facility patients" ON public.patients
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can delete patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete organization patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete facility patients" ON public.patients;
CREATE POLICY "Users can delete facility patients" ON public.patients
FOR DELETE USING (
    facility_id = public.get_user_facility_id()
);

-- Issues policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view all issues" ON public.issues;
DROP POLICY IF EXISTS "Users can view organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can view facility issues" ON public.issues;
CREATE POLICY "Users can view facility issues" ON public.issues
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can create issues" ON public.issues;
DROP POLICY IF EXISTS "Users can create organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can create facility issues" ON public.issues;
CREATE POLICY "Users can create facility issues" ON public.issues
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can update issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update facility issues" ON public.issues;
CREATE POLICY "Users can update facility issues" ON public.issues
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can delete issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete organization issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete facility issues" ON public.issues;
CREATE POLICY "Users can delete facility issues" ON public.issues
FOR DELETE USING (
    facility_id = public.get_user_facility_id()
);

-- Issue messages policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can view organization issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can view facility issue messages" ON public.issue_messages;
CREATE POLICY "Users can view facility issue messages" ON public.issue_messages
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can create issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can create organization issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can create facility issue messages" ON public.issue_messages;
CREATE POLICY "Users can create facility issue messages" ON public.issue_messages
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id()
);

-- Issue audit log policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view audit log" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Users can view organization audit log" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Users can view facility audit log" ON public.issue_audit_log;
CREATE POLICY "Users can view facility audit log" ON public.issue_audit_log
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

-- Handoffs policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can view organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can view facility handoffs" ON public.handoffs;
CREATE POLICY "Users can view facility handoffs" ON public.handoffs
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can create handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can create organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can create facility handoffs" ON public.handoffs;
CREATE POLICY "Users can create facility handoffs" ON public.handoffs
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can update handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can update organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can update facility handoffs" ON public.handoffs;
CREATE POLICY "Users can update facility handoffs" ON public.handoffs
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can delete handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can delete organization handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can delete facility handoffs" ON public.handoffs;
CREATE POLICY "Users can delete facility handoffs" ON public.handoffs
FOR DELETE USING (
    facility_id = public.get_user_facility_id()
);

-- User roles policies (facility-scoped)
DROP POLICY IF EXISTS "Users can view their role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view organization roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view facility roles" ON public.user_roles;
CREATE POLICY "Users can view facility roles" ON public.user_roles
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can insert their role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert organization roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert facility roles" ON public.user_roles;
CREATE POLICY "Users can insert facility roles" ON public.user_roles
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id()
);

DROP POLICY IF EXISTS "Users can update their role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update organization roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update facility roles" ON public.user_roles;
CREATE POLICY "Users can update facility roles" ON public.user_roles
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

-- =====================================================
-- STEP 7: Add comment
-- =====================================================

COMMENT ON TABLE public.facilities IS 'Healthcare facilities for multi-tenant data isolation';
COMMENT ON FUNCTION public.get_user_facility_id() IS 'Returns the facility_id of the current authenticated user';
COMMENT ON FUNCTION public.user_belongs_to_facility(uuid) IS 'Checks if the current user belongs to the specified facility';
