-- Multi-Tenancy Migration
-- This migration adds organization-level data isolation for enterprise SaaS deployment

-- =====================================================
-- STEP 1: Create organizations table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL, -- URL-friendly identifier
    settings jsonb DEFAULT '{}'::jsonb, -- Organization-specific settings
    subscription_tier text DEFAULT 'free', -- free, pro, enterprise
    max_users integer DEFAULT 10,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS organizations_slug_idx ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_is_active_idx ON public.organizations(is_active);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Add organization_id to existing tables
-- =====================================================

-- Add organization_id to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON public.users(organization_id);

-- Add organization_id to patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS patients_organization_id_idx ON public.patients(organization_id);

-- Add organization_id to issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issues_organization_id_idx ON public.issues(organization_id);

-- Add organization_id to issue_messages table
ALTER TABLE public.issue_messages
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_messages_organization_id_idx ON public.issue_messages(organization_id);

-- Add organization_id to issue_audit_log table
ALTER TABLE public.issue_audit_log
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_audit_log_organization_id_idx ON public.issue_audit_log(organization_id);

-- Add organization_id to handoffs table
ALTER TABLE public.handoffs
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS handoffs_organization_id_idx ON public.handoffs(organization_id);

-- Add organization_id to user_roles table
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_organization_id_idx ON public.user_roles(organization_id);

-- =====================================================
-- STEP 3: Create helper functions
-- =====================================================

-- Function to get current user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE id = auth.uid();

    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: Update triggers to auto-populate organization_id
-- =====================================================

-- Trigger function to auto-populate organization_id on issues
CREATE OR REPLACE FUNCTION public.set_issue_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_organization_id_trigger ON public.issues;
CREATE TRIGGER set_issue_organization_id_trigger
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.set_issue_organization_id();

-- Trigger function to auto-populate organization_id on patients
CREATE OR REPLACE FUNCTION public.set_patient_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_patient_organization_id_trigger ON public.patients;
CREATE TRIGGER set_patient_organization_id_trigger
BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_organization_id();

-- Trigger function to auto-populate organization_id on issue_messages
CREATE OR REPLACE FUNCTION public.set_issue_message_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_message_organization_id_trigger ON public.issue_messages;
CREATE TRIGGER set_issue_message_organization_id_trigger
BEFORE INSERT ON public.issue_messages
FOR EACH ROW EXECUTE FUNCTION public.set_issue_message_organization_id();

-- Trigger function to auto-populate organization_id on issue_audit_log
CREATE OR REPLACE FUNCTION public.set_audit_log_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_audit_log_organization_id_trigger ON public.issue_audit_log;
CREATE TRIGGER set_audit_log_organization_id_trigger
BEFORE INSERT ON public.issue_audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_organization_id();

-- Trigger function to auto-populate organization_id on handoffs
CREATE OR REPLACE FUNCTION public.set_handoff_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_handoff_organization_id_trigger ON public.handoffs;
CREATE TRIGGER set_handoff_organization_id_trigger
BEFORE INSERT ON public.handoffs
FOR EACH ROW EXECUTE FUNCTION public.set_handoff_organization_id();

-- =====================================================
-- STEP 5: Update RLS policies for multi-tenancy
-- =====================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
CREATE POLICY "Users can view their organization" ON public.organizations
FOR SELECT USING (
    id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update their organization" ON public.organizations;
CREATE POLICY "Users can update their organization" ON public.organizations
FOR UPDATE USING (
    id = public.get_user_organization_id()
);

-- Users policies (allow viewing users in same organization)
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;
CREATE POLICY "Users can view organization members" ON public.users
FOR SELECT USING (
    organization_id = public.get_user_organization_id() OR
    id = auth.uid()
);

-- Patients policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view all patients" ON public.patients;
CREATE POLICY "Users can view organization patients" ON public.patients
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
CREATE POLICY "Users can insert organization patients" ON public.patients
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
CREATE POLICY "Users can update organization patients" ON public.patients
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete patients" ON public.patients;
CREATE POLICY "Users can delete organization patients" ON public.patients
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- Issues policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view all issues" ON public.issues;
CREATE POLICY "Users can view organization issues" ON public.issues
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create issues" ON public.issues;
CREATE POLICY "Users can create organization issues" ON public.issues
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update issues" ON public.issues;
CREATE POLICY "Users can update organization issues" ON public.issues
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete issues" ON public.issues;
CREATE POLICY "Users can delete organization issues" ON public.issues
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- Issue messages policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view issue messages" ON public.issue_messages;
CREATE POLICY "Users can view organization issue messages" ON public.issue_messages
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create issue messages" ON public.issue_messages;
CREATE POLICY "Users can create organization issue messages" ON public.issue_messages
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

-- Issue audit log policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view audit log" ON public.issue_audit_log;
CREATE POLICY "Users can view organization audit log" ON public.issue_audit_log
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

-- Handoffs policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view handoffs" ON public.handoffs;
CREATE POLICY "Users can view organization handoffs" ON public.handoffs
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create handoffs" ON public.handoffs;
CREATE POLICY "Users can create organization handoffs" ON public.handoffs
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update handoffs" ON public.handoffs;
CREATE POLICY "Users can update organization handoffs" ON public.handoffs
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete handoffs" ON public.handoffs;
CREATE POLICY "Users can delete organization handoffs" ON public.handoffs
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- User roles policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view their role" ON public.user_roles;
CREATE POLICY "Users can view organization roles" ON public.user_roles
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can insert their role" ON public.user_roles;
CREATE POLICY "Users can insert organization roles" ON public.user_roles
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update their role" ON public.user_roles;
CREATE POLICY "Users can update organization roles" ON public.user_roles
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

-- =====================================================
-- STEP 6: Create organization management functions
-- =====================================================

-- Function to create a new organization with first user as admin
CREATE OR REPLACE FUNCTION public.create_organization(
    org_name text,
    org_slug text
)
RETURNS uuid AS $$
DECLARE
    new_org_id uuid;
BEGIN
    -- Insert new organization
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO new_org_id;

    -- Update current user's organization
    UPDATE public.users
    SET organization_id = new_org_id
    WHERE id = auth.uid();

    -- Set user role as coordinator (admin)
    INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'coordinator', new_org_id)
    ON CONFLICT (user_id) DO UPDATE
    SET role = 'coordinator', organization_id = new_org_id;

    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Add updated_at trigger for organizations
-- =====================================================

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 8: Migration note
-- =====================================================

-- IMPORTANT: After running this migration, you need to:
-- 1. Create at least one organization
-- 2. Assign all existing users to an organization
-- 3. Update existing data to have organization_id set
--
-- For development/testing, you can run:
-- INSERT INTO public.organizations (name, slug) VALUES ('Demo Organization', 'demo-org');
-- UPDATE public.users SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.patients SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issues SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issue_messages SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issue_audit_log SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.handoffs SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.user_roles SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
