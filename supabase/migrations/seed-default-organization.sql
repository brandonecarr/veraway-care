-- Seed Default Organization
-- This migration creates a default organization and assigns all existing data to it
-- Run this AFTER add-multi-tenancy.sql migration

DO $$
DECLARE
    default_org_id uuid;
    existing_org_count integer;
BEGIN
    -- Check if any organizations already exist
    SELECT COUNT(*) INTO existing_org_count FROM public.organizations;

    -- Only create default organization if none exists
    IF existing_org_count = 0 THEN
        -- Create default organization
        INSERT INTO public.organizations (name, slug, subscription_tier, max_users, is_active)
        VALUES ('Default Organization', 'default-org', 'enterprise', 999, true)
        RETURNING id INTO default_org_id;

        RAISE NOTICE 'Created default organization with ID: %', default_org_id;

        -- Assign all existing users to default organization
        UPDATE public.users
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing users to default organization';

        -- Assign all existing patients to default organization
        UPDATE public.patients
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing patients to default organization';

        -- Assign all existing issues to default organization
        UPDATE public.issues
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing issues to default organization';

        -- Assign all existing issue messages to default organization
        UPDATE public.issue_messages
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing issue messages to default organization';

        -- Assign all existing audit log entries to default organization
        UPDATE public.issue_audit_log
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing audit log entries to default organization';

        -- Assign all existing handoffs to default organization
        UPDATE public.handoffs
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing handoffs to default organization';

        -- Assign all existing user roles to default organization
        UPDATE public.user_roles
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing user roles to default organization';

        RAISE NOTICE 'Default organization migration completed successfully';
    ELSE
        RAISE NOTICE 'Organizations already exist, skipping default organization creation';
    END IF;
END $$;
