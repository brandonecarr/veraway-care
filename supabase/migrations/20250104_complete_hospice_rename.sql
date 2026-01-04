-- Complete Hospice Rename Migration
-- This migration updates ALL database functions, triggers, and RLS policies
-- to use hospice_id instead of facility_id

-- =====================================================
-- STEP 1: Drop ALL policies that depend on get_user_facility_id() FIRST
-- =====================================================

-- Hospices table
DROP POLICY IF EXISTS "Users can view their facility" ON public.hospices;
DROP POLICY IF EXISTS "Users can update their facility" ON public.hospices;

-- Users table
DROP POLICY IF EXISTS "Users can view facility members" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their facility" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their hospice" ON public.users;
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
DROP POLICY IF EXISTS "Users can view users in same hospice" ON public.users;
DROP POLICY IF EXISTS "Users can view all users for joins" ON public.users;

-- Patients table
DROP POLICY IF EXISTS "Users can view facility patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert facility patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update facility patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete facility patients" ON public.patients;
DROP POLICY IF EXISTS "Users can view patients in their hospice" ON public.patients;
DROP POLICY IF EXISTS "Users can view patients in their facility" ON public.patients;

-- Issues table
DROP POLICY IF EXISTS "Users can view facility issues" ON public.issues;
DROP POLICY IF EXISTS "Users can create facility issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update facility issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete facility issues" ON public.issues;
DROP POLICY IF EXISTS "Users can view issues in their hospice" ON public.issues;
DROP POLICY IF EXISTS "Users can view issues in their facility" ON public.issues;

-- Issue messages table
DROP POLICY IF EXISTS "Users can view facility issue messages" ON public.issue_messages;
DROP POLICY IF EXISTS "Users can create facility issue messages" ON public.issue_messages;

-- Issue audit log table
DROP POLICY IF EXISTS "Users can view facility audit log" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Users can view audit_log in their hospice" ON public.issue_audit_log;
DROP POLICY IF EXISTS "Users can view audit_log in their facility" ON public.issue_audit_log;

-- Handoffs table
DROP POLICY IF EXISTS "Users can view facility handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can create facility handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can update facility handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can delete facility handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "Users can view handoffs in their hospice" ON public.handoffs;
DROP POLICY IF EXISTS "Users can view handoffs in their facility" ON public.handoffs;

-- User roles table
DROP POLICY IF EXISTS "Users can view facility roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert facility roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update facility roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their hospice" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their facility" ON public.user_roles;

-- Conversations table
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations in their hospice" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations in their facility" ON public.conversations;

-- Conversation participants
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

-- IDG tables
DROP POLICY IF EXISTS "Users can view idg_reviews in their hospice" ON public.idg_reviews;
DROP POLICY IF EXISTS "Users can view idg_reviews in their facility" ON public.idg_reviews;
DROP POLICY IF EXISTS "Users can view idg_issue_status in their hospice" ON public.idg_issue_status;
DROP POLICY IF EXISTS "Users can view idg_issue_status in their facility" ON public.idg_issue_status;

-- =====================================================
-- STEP 2: Now drop old facility-based functions (policies gone)
-- =====================================================

DROP FUNCTION IF EXISTS public.get_user_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.user_belongs_to_facility(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_issue_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_patient_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_issue_message_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_audit_log_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_handoff_facility_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_metrics() CASCADE;

-- Drop old triggers
DROP TRIGGER IF EXISTS set_issue_facility_id_trigger ON public.issues;
DROP TRIGGER IF EXISTS set_patient_facility_id_trigger ON public.patients;
DROP TRIGGER IF EXISTS set_issue_message_facility_id_trigger ON public.issue_messages;
DROP TRIGGER IF EXISTS set_audit_log_facility_id_trigger ON public.issue_audit_log;
DROP TRIGGER IF EXISTS set_handoff_facility_id_trigger ON public.handoffs;

-- =====================================================
-- STEP 3: Create hospice-based helper functions
-- =====================================================

-- Function to get current user's hospice_id (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_user_hospice_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hospice_id FROM users WHERE id = auth.uid()
$$;

-- Function to check if user belongs to hospice
CREATE OR REPLACE FUNCTION public.user_belongs_to_hospice(hosp_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND hospice_id = hosp_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: Create hospice-based trigger functions
-- =====================================================

-- Auto-populate hospice_id on issues
CREATE OR REPLACE FUNCTION public.set_issue_hospice_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hospice_id IS NULL THEN
        NEW.hospice_id := public.get_user_hospice_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_issue_hospice_id_trigger ON public.issues;
CREATE TRIGGER set_issue_hospice_id_trigger
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.set_issue_hospice_id();

-- Auto-populate hospice_id on patients
CREATE OR REPLACE FUNCTION public.set_patient_hospice_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hospice_id IS NULL THEN
        NEW.hospice_id := public.get_user_hospice_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_patient_hospice_id_trigger ON public.patients;
CREATE TRIGGER set_patient_hospice_id_trigger
BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_hospice_id();

-- Auto-populate hospice_id on issue_messages (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_messages' AND column_name = 'hospice_id'
    ) THEN
        CREATE OR REPLACE FUNCTION public.set_issue_message_hospice_id()
        RETURNS TRIGGER AS $func$
        BEGIN
            IF NEW.hospice_id IS NULL THEN
                NEW.hospice_id := public.get_user_hospice_id();
            END IF;
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;

        DROP TRIGGER IF EXISTS set_issue_message_hospice_id_trigger ON public.issue_messages;
        CREATE TRIGGER set_issue_message_hospice_id_trigger
        BEFORE INSERT ON public.issue_messages
        FOR EACH ROW EXECUTE FUNCTION public.set_issue_message_hospice_id();
    END IF;
END $$;

-- Auto-populate hospice_id on issue_audit_log (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_audit_log' AND column_name = 'hospice_id'
    ) THEN
        CREATE OR REPLACE FUNCTION public.set_audit_log_hospice_id()
        RETURNS TRIGGER AS $func$
        BEGIN
            IF NEW.hospice_id IS NULL THEN
                NEW.hospice_id := public.get_user_hospice_id();
            END IF;
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;

        DROP TRIGGER IF EXISTS set_audit_log_hospice_id_trigger ON public.issue_audit_log;
        CREATE TRIGGER set_audit_log_hospice_id_trigger
        BEFORE INSERT ON public.issue_audit_log
        FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_hospice_id();
    END IF;
END $$;

-- Auto-populate hospice_id on handoffs (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoffs') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'handoffs' AND column_name = 'hospice_id'
        ) THEN
            CREATE OR REPLACE FUNCTION public.set_handoff_hospice_id()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.hospice_id IS NULL THEN
                    NEW.hospice_id := public.get_user_hospice_id();
                END IF;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;

            DROP TRIGGER IF EXISTS set_handoff_hospice_id_trigger ON public.handoffs;
            CREATE TRIGGER set_handoff_hospice_id_trigger
            BEFORE INSERT ON public.handoffs
            FOR EACH ROW EXECUTE FUNCTION public.set_handoff_hospice_id();
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 5: Create new hospice-based RLS policies
-- =====================================================

-- Users policies
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
CREATE POLICY "Users can view own record" ON public.users
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can view users in same hospice" ON public.users;
CREATE POLICY "Users can view users in same hospice" ON public.users
    FOR SELECT USING (hospice_id = public.get_user_hospice_id());

-- Hospices policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospices') THEN
        ALTER TABLE public.hospices ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Users can view their hospice" ON public.hospices;
        CREATE POLICY "Users can view their hospice" ON public.hospices
            FOR SELECT USING (id = public.get_user_hospice_id());

        DROP POLICY IF EXISTS "Users can update their hospice" ON public.hospices;
        CREATE POLICY "Users can update their hospice" ON public.hospices
            FOR UPDATE USING (id = public.get_user_hospice_id());
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Patients policies
DROP POLICY IF EXISTS "Users can view hospice patients" ON public.patients;
CREATE POLICY "Users can view hospice patients" ON public.patients
    FOR SELECT USING (hospice_id = public.get_user_hospice_id());

DROP POLICY IF EXISTS "Users can insert hospice patients" ON public.patients;
CREATE POLICY "Users can insert hospice patients" ON public.patients
    FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);

DROP POLICY IF EXISTS "Users can update hospice patients" ON public.patients;
CREATE POLICY "Users can update hospice patients" ON public.patients
    FOR UPDATE USING (hospice_id = public.get_user_hospice_id());

DROP POLICY IF EXISTS "Users can delete hospice patients" ON public.patients;
CREATE POLICY "Users can delete hospice patients" ON public.patients
    FOR DELETE USING (hospice_id = public.get_user_hospice_id());

-- Issues policies
DROP POLICY IF EXISTS "Users can view hospice issues" ON public.issues;
CREATE POLICY "Users can view hospice issues" ON public.issues
    FOR SELECT USING (hospice_id = public.get_user_hospice_id());

DROP POLICY IF EXISTS "Users can create hospice issues" ON public.issues;
CREATE POLICY "Users can create hospice issues" ON public.issues
    FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);

DROP POLICY IF EXISTS "Users can update hospice issues" ON public.issues;
CREATE POLICY "Users can update hospice issues" ON public.issues
    FOR UPDATE USING (hospice_id = public.get_user_hospice_id());

DROP POLICY IF EXISTS "Users can delete hospice issues" ON public.issues;
CREATE POLICY "Users can delete hospice issues" ON public.issues
    FOR DELETE USING (hospice_id = public.get_user_hospice_id());

-- Issue messages policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice issue messages" ON public.issue_messages;
    DROP POLICY IF EXISTS "Users can create hospice issue messages" ON public.issue_messages;
    DROP POLICY IF EXISTS "Users can view issue messages" ON public.issue_messages;
    DROP POLICY IF EXISTS "Users can create issue messages" ON public.issue_messages;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_messages' AND column_name = 'hospice_id'
    ) THEN
        CREATE POLICY "Users can view hospice issue messages" ON public.issue_messages
            FOR SELECT USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can create hospice issue messages" ON public.issue_messages
            FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);
    ELSE
        -- If no hospice_id column, allow based on issue relationship
        CREATE POLICY "Users can view issue messages" ON public.issue_messages
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.issues i
                    WHERE i.id = issue_messages.issue_id
                    AND i.hospice_id = public.get_user_hospice_id()
                )
            );

        CREATE POLICY "Users can create issue messages" ON public.issue_messages
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.issues i
                    WHERE i.id = issue_messages.issue_id
                    AND i.hospice_id = public.get_user_hospice_id()
                )
            );
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Issue audit log policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice audit log" ON public.issue_audit_log;
    DROP POLICY IF EXISTS "Users can view audit log" ON public.issue_audit_log;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'issue_audit_log' AND column_name = 'hospice_id'
    ) THEN
        CREATE POLICY "Users can view hospice audit log" ON public.issue_audit_log
            FOR SELECT USING (hospice_id = public.get_user_hospice_id());
    ELSE
        -- If no hospice_id column, allow based on issue relationship
        CREATE POLICY "Users can view audit log" ON public.issue_audit_log
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.issues i
                    WHERE i.id = issue_audit_log.issue_id
                    AND i.hospice_id = public.get_user_hospice_id()
                )
            );
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Handoffs policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice handoffs" ON public.handoffs;
    DROP POLICY IF EXISTS "Users can create hospice handoffs" ON public.handoffs;
    DROP POLICY IF EXISTS "Users can update hospice handoffs" ON public.handoffs;
    DROP POLICY IF EXISTS "Users can delete hospice handoffs" ON public.handoffs;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoffs') THEN
        CREATE POLICY "Users can view hospice handoffs" ON public.handoffs
            FOR SELECT USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can create hospice handoffs" ON public.handoffs
            FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);

        CREATE POLICY "Users can update hospice handoffs" ON public.handoffs
            FOR UPDATE USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can delete hospice handoffs" ON public.handoffs
            FOR DELETE USING (hospice_id = public.get_user_hospice_id());
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view hospice roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view hospice roles" ON public.user_roles
    FOR SELECT USING (hospice_id = public.get_user_hospice_id());

-- Conversations policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can update hospice conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Users can create hospice conversations" ON public.conversations;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        CREATE POLICY "Users can view hospice conversations" ON public.conversations
            FOR SELECT USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can update hospice conversations" ON public.conversations
            FOR UPDATE USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can create hospice conversations" ON public.conversations
            FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversation participants policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
    DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_participants') THEN
        CREATE POLICY "Users can view conversation participants" ON public.conversation_participants
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.conversations c
                    WHERE c.id = conversation_participants.conversation_id
                    AND c.hospice_id = public.get_user_hospice_id()
                )
            );

        CREATE POLICY "Users can add participants" ON public.conversation_participants
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.conversations c
                    WHERE c.id = conversation_participants.conversation_id
                    AND c.hospice_id = public.get_user_hospice_id()
                )
            );
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- IDG reviews policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice idg_reviews" ON public.idg_reviews;
    DROP POLICY IF EXISTS "Users can create hospice idg_reviews" ON public.idg_reviews;
    DROP POLICY IF EXISTS "Users can update hospice idg_reviews" ON public.idg_reviews;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idg_reviews') THEN
        CREATE POLICY "Users can view hospice idg_reviews" ON public.idg_reviews
            FOR SELECT USING (hospice_id = public.get_user_hospice_id());

        CREATE POLICY "Users can create hospice idg_reviews" ON public.idg_reviews
            FOR INSERT WITH CHECK (hospice_id = public.get_user_hospice_id() OR hospice_id IS NULL);

        CREATE POLICY "Users can update hospice idg_reviews" ON public.idg_reviews
            FOR UPDATE USING (hospice_id = public.get_user_hospice_id());
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- IDG issue status policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view hospice idg_issue_status" ON public.idg_issue_status;
    DROP POLICY IF EXISTS "Users can manage hospice idg_issue_status" ON public.idg_issue_status;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idg_issue_status') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'idg_issue_status' AND column_name = 'hospice_id'
        ) THEN
            CREATE POLICY "Users can view hospice idg_issue_status" ON public.idg_issue_status
                FOR SELECT USING (hospice_id = public.get_user_hospice_id());

            CREATE POLICY "Users can manage hospice idg_issue_status" ON public.idg_issue_status
                FOR ALL USING (hospice_id = public.get_user_hospice_id());
        END IF;
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- STEP 6: Update dashboard metrics function
-- =====================================================

-- Drop existing function variants to allow signature change
DROP FUNCTION IF EXISTS public.get_dashboard_metrics();
DROP FUNCTION IF EXISTS public.get_dashboard_metrics(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_user_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    total_issues_count integer;
    open_issues_count integer;
    overdue_issues_count integer;
    resolved_today_count integer;
    avg_resolution_hours numeric;
    issues_by_type_data jsonb;
    clinician_data jsonb;
    user_hospice_id uuid;
BEGIN
    -- Get the user's hospice_id
    IF p_user_id IS NOT NULL THEN
        SELECT hospice_id INTO user_hospice_id
        FROM public.users
        WHERE id = p_user_id;
    ELSE
        user_hospice_id := public.get_user_hospice_id();
    END IF;

    -- If user has no hospice, return empty metrics
    IF user_hospice_id IS NULL THEN
        result := jsonb_build_object(
            'totalIssues', 0,
            'openIssues', 0,
            'overdueIssues', 0,
            'resolvedToday', 0,
            'avgResolutionTime', 0,
            'issuesByType', '[]'::jsonb,
            'clinicianResponsiveness', '[]'::jsonb
        );
        RETURN result;
    END IF;

    -- Total issues for this hospice
    SELECT COUNT(*) INTO total_issues_count
    FROM public.issues
    WHERE hospice_id = user_hospice_id;

    -- Open issues (open or in_progress) for this hospice
    SELECT COUNT(*) INTO open_issues_count
    FROM public.issues
    WHERE hospice_id = user_hospice_id
    AND status IN ('open', 'in_progress');

    -- Overdue issues (using last_activity_at if available, otherwise created_at)
    SELECT COUNT(*) INTO overdue_issues_count
    FROM public.issues
    WHERE hospice_id = user_hospice_id
    AND status != 'resolved'
    AND COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '24 hours';

    -- Resolved today for this hospice
    SELECT COUNT(*) INTO resolved_today_count
    FROM public.issues
    WHERE hospice_id = user_hospice_id
    AND status = 'resolved'
    AND resolved_at >= CURRENT_DATE;

    -- Average resolution time (in hours) for this hospice
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
        0
    ) INTO avg_resolution_hours
    FROM public.issues
    WHERE hospice_id = user_hospice_id
    AND status = 'resolved'
    AND resolved_at IS NOT NULL;

    -- Issues by type (only non-resolved) for this hospice
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', issue_type,
            'count', count
        ) ORDER BY count DESC
    ) INTO issues_by_type_data
    FROM (
        SELECT issue_type, COUNT(*)::integer as count
        FROM public.issues
        WHERE hospice_id = user_hospice_id
        AND status != 'resolved'
        GROUP BY issue_type
    ) subquery;

    -- Clinician responsiveness for this hospice only
    SELECT jsonb_agg(
        jsonb_build_object(
            'userId', user_id,
            'name', name,
            'email', email,
            'avgResponseTime', avg_response_time,
            'issuesResolved', issues_resolved,
            'openIssues', open_issues
        ) ORDER BY issues_resolved DESC
    ) INTO clinician_data
    FROM (
        SELECT
            u.id as user_id,
            COALESCE(u.name, split_part(u.email, '@', 1), 'Unknown') as name,
            COALESCE(u.email, '') as email,
            COALESCE(
                AVG(
                    CASE
                        WHEN i.status = 'resolved' AND i.resolved_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600
                        ELSE NULL
                    END
                ),
                0
            ) as avg_response_time,
            COUNT(CASE WHEN i.status = 'resolved' THEN 1 END)::integer as issues_resolved,
            COUNT(CASE WHEN i.status != 'resolved' THEN 1 END)::integer as open_issues
        FROM public.users u
        INNER JOIN public.issues i ON
            (i.assigned_to = u.id OR i.resolved_by = u.id)
            AND i.hospice_id = user_hospice_id
        WHERE u.hospice_id = user_hospice_id
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(i.id) > 0
    ) clinician_stats;

    -- Build final result
    result := jsonb_build_object(
        'totalIssues', total_issues_count,
        'openIssues', open_issues_count,
        'overdueIssues', overdue_issues_count,
        'resolvedToday', resolved_today_count,
        'avgResolutionTime', ROUND(avg_resolution_hours::numeric, 2),
        'issuesByType', COALESCE(issues_by_type_data, '[]'::jsonb),
        'clinicianResponsiveness', COALESCE(clinician_data, '[]'::jsonb)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_dashboard_metrics(uuid) IS 'Calculates all dashboard metrics for the specified user''s hospice. Returns JSON object with metrics.';

-- =====================================================
-- STEP 7: Update indexes to use hospice_id
-- =====================================================

-- Drop old facility_id indexes
DROP INDEX IF EXISTS idx_conversations_facility_last_message;
DROP INDEX IF EXISTS idx_issues_facility_status_created;
DROP INDEX IF EXISTS users_facility_id_idx;
DROP INDEX IF EXISTS patients_facility_id_idx;
DROP INDEX IF EXISTS issues_facility_id_idx;
DROP INDEX IF EXISTS issue_messages_facility_id_idx;
DROP INDEX IF EXISTS issue_audit_log_facility_id_idx;
DROP INDEX IF EXISTS handoffs_facility_id_idx;
DROP INDEX IF EXISTS user_roles_facility_id_idx;

-- Create new hospice_id indexes
CREATE INDEX IF NOT EXISTS users_hospice_id_idx ON public.users(hospice_id);
CREATE INDEX IF NOT EXISTS patients_hospice_id_idx ON public.patients(hospice_id);
CREATE INDEX IF NOT EXISTS issues_hospice_id_idx ON public.issues(hospice_id);
CREATE INDEX IF NOT EXISTS issues_hospice_status_created_idx ON public.issues(hospice_id, status, created_at DESC);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issue_messages' AND column_name = 'hospice_id') THEN
        CREATE INDEX IF NOT EXISTS issue_messages_hospice_id_idx ON public.issue_messages(hospice_id);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issue_audit_log' AND column_name = 'hospice_id') THEN
        CREATE INDEX IF NOT EXISTS issue_audit_log_hospice_id_idx ON public.issue_audit_log(hospice_id);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'handoffs') THEN
        CREATE INDEX IF NOT EXISTS handoffs_hospice_id_idx ON public.handoffs(hospice_id);
    END IF;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS user_roles_hospice_id_idx ON public.user_roles(hospice_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        CREATE INDEX IF NOT EXISTS conversations_hospice_last_message_idx ON public.conversations(hospice_id, last_message_at DESC);
    END IF;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- =====================================================
-- STEP 8: Add comments