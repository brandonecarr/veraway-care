-- CRITICAL SECURITY FIX: Add tenant isolation to get_idg_issues function
-- The function was returning data from ALL hospices, not just the current user's hospice

CREATE OR REPLACE FUNCTION public.get_idg_issues(
    p_week_start timestamp with time zone,
    p_week_end timestamp with time zone,
    p_threshold_hours integer DEFAULT 24
)
RETURNS TABLE (
    id uuid,
    issue_number integer,
    patient_id uuid,
    patient_name text,
    patient_mrn text,
    issue_type text,
    description text,
    status text,
    priority text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    assigned_to uuid,
    assignee_name text,
    assignee_job_role text,
    reported_by uuid,
    reporter_name text,
    hours_open numeric,
    is_overdue boolean,
    idg_reason text
) AS $$
DECLARE
    user_hospice_id uuid;
    idg_issue_types text[] := ARRAY[
        'Change in Condition',
        'Death',
        'Infection',
        'Incident',
        'Unmanaged Pain',
        'Missed/Declined Visit',
        'Not Following Plan-of-Care'
    ];
BEGIN
    -- CRITICAL: Get the current user's hospice_id for tenant isolation
    SELECT hospice_id INTO user_hospice_id
    FROM public.users
    WHERE id = auth.uid();

    -- If no hospice_id found, return empty result set (don't leak data)
    IF user_hospice_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        i.id,
        i.issue_number,
        i.patient_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient')::text as patient_name,
        COALESCE(p.mrn, '')::text as patient_mrn,
        i.issue_type,
        i.description,
        i.status,
        i.priority,
        i.created_at,
        i.updated_at,
        i.assigned_to,
        COALESCE(u.name, split_part(u.email, '@', 1), 'Unassigned')::text as assignee_name,
        ur.job_role as assignee_job_role,
        i.reported_by,
        COALESCE(reporter.name, split_part(reporter.email, '@', 1), 'Unknown')::text as reporter_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600, 1) as hours_open,
        (EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600) > p_threshold_hours as is_overdue,
        CASE
            WHEN i.priority IN ('high', 'urgent') THEN 'High/Urgent Priority'
            WHEN i.issue_type = ANY(idg_issue_types) THEN 'IDG Issue Type'
            WHEN (EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600) > p_threshold_hours THEN 'Unresolved > ' || p_threshold_hours || 'h'
            ELSE 'Multiple Criteria'
        END as idg_reason
    FROM public.issues i
    LEFT JOIN public.patients p ON i.patient_id = p.id
    LEFT JOIN public.users u ON i.assigned_to = u.id
    LEFT JOIN public.user_roles ur ON i.assigned_to = ur.user_id AND ur.hospice_id = i.hospice_id
    LEFT JOIN public.users reporter ON i.reported_by = reporter.id
    WHERE
        -- CRITICAL: Filter by user's hospice_id for tenant isolation
        i.hospice_id = user_hospice_id
        AND i.status IN ('open', 'in_progress')
        AND i.created_at <= p_week_end
        AND (
            -- Criteria 1: Unresolved after threshold hours
            (EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600) > p_threshold_hours
            -- Criteria 2: IDG issue types (regardless of age)
            OR i.issue_type = ANY(idg_issue_types)
            -- Criteria 3: High or urgent priority
            OR i.priority IN ('high', 'urgent')
        )
    ORDER BY
        CASE i.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            ELSE 4
        END,
        i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.get_idg_issues IS 'Fetches issues meeting IDG review criteria for a given week. SECURITY: Filters by current user hospice_id for tenant isolation.';

-- CRITICAL SECURITY FIX: Add tenant isolation to get_idg_issue_actions function
-- The function must verify that the issues belong to the current user's hospice
CREATE OR REPLACE FUNCTION public.get_idg_issue_actions(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    actions jsonb
) AS $$
DECLARE
    user_hospice_id uuid;
BEGIN
    -- CRITICAL: Get the current user's hospice_id for tenant isolation
    SELECT hospice_id INTO user_hospice_id
    FROM public.users
    WHERE id = auth.uid();

    -- If no hospice_id found, return empty result set (don't leak data)
    IF user_hospice_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        a.issue_id,
        jsonb_agg(
            jsonb_build_object(
                'action', a.action,
                'details', a.details,
                'created_at', a.created_at,
                'user_name', COALESCE(u.name, split_part(u.email, '@', 1), 'System')
            ) ORDER BY a.created_at DESC
        ) as actions
    FROM public.issue_audit_log a
    LEFT JOIN public.users u ON a.user_id = u.id
    -- CRITICAL: Join to issues table to verify hospice_id
    INNER JOIN public.issues i ON a.issue_id = i.id AND i.hospice_id = user_hospice_id
    WHERE a.issue_id = ANY(p_issue_ids)
    GROUP BY a.issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_idg_issue_actions IS 'Fetches audit log actions for specified issues. SECURITY: Verifies issues belong to current user hospice for tenant isolation.';

-- CRITICAL SECURITY FIX: Add tenant isolation to get_idg_issue_messages function
CREATE OR REPLACE FUNCTION public.get_idg_issue_messages(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    messages jsonb
) AS $$
DECLARE
    user_hospice_id uuid;
BEGIN
    -- CRITICAL: Get the current user's hospice_id for tenant isolation
    SELECT hospice_id INTO user_hospice_id
    FROM public.users
    WHERE id = auth.uid();

    -- If no hospice_id found, return empty result set (don't leak data)
    IF user_hospice_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        m.issue_id,
        jsonb_agg(
            jsonb_build_object(
                'message', m.message,
                'created_at', m.created_at,
                'user_name', COALESCE(u.name, split_part(u.email, '@', 1), 'Unknown')
            ) ORDER BY m.created_at DESC
        ) as messages
    FROM public.issue_messages m
    LEFT JOIN public.users u ON m.user_id = u.id
    -- CRITICAL: Join to issues table to verify hospice_id
    INNER JOIN public.issues i ON m.issue_id = i.id AND i.hospice_id = user_hospice_id
    WHERE m.issue_id = ANY(p_issue_ids)
    GROUP BY m.issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_idg_issue_messages IS 'Fetches messages for specified issues. SECURITY: Verifies issues belong to current user hospice for tenant isolation.';

-- CRITICAL SECURITY FIX: Add tenant isolation to get_idg_issue_statuses function
CREATE OR REPLACE FUNCTION public.get_idg_issue_statuses(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    flagged_for_md_review boolean,
    idg_disposition text,
    reviewed_in_idg boolean
) AS $$
DECLARE
    user_hospice_id uuid;
BEGIN
    -- CRITICAL: Get the current user's hospice_id for tenant isolation
    SELECT hospice_id INTO user_hospice_id
    FROM public.users
    WHERE id = auth.uid();

    -- If no hospice_id found, return empty result set (don't leak data)
    IF user_hospice_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.issue_id,
        COALESCE(s.flagged_for_md_review, false),
        s.idg_disposition,
        COALESCE(s.reviewed_in_idg, false)
    FROM public.idg_issue_status s
    -- CRITICAL: Join to issues table to verify hospice_id
    INNER JOIN public.issues i ON s.issue_id = i.id AND i.hospice_id = user_hospice_id
    WHERE s.issue_id = ANY(p_issue_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_idg_issue_statuses IS 'Fetches IDG status for specified issues. SECURITY: Verifies issues belong to current user hospice for tenant isolation.';

-- CRITICAL SECURITY FIX: Add tenant isolation to get_idg_summary_counts function
-- Also fixing facility_id -> hospice_id
-- Must drop old function first because parameter name changed from p_facility_id to p_hospice_id
DROP FUNCTION IF EXISTS public.get_idg_summary_counts(uuid, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_idg_summary_counts(
    p_hospice_id uuid,
    p_week_start timestamp with time zone,
    p_week_end timestamp with time zone
)
RETURNS TABLE (
    deaths_count bigint,
    admissions_count bigint
) AS $$
DECLARE
    user_hospice_id uuid;
BEGIN
    -- CRITICAL: Get the current user's hospice_id for tenant isolation
    SELECT hospice_id INTO user_hospice_id
    FROM public.users
    WHERE id = auth.uid();

    -- CRITICAL: Verify user can only access their own hospice data
    IF user_hospice_id IS NULL OR user_hospice_id != p_hospice_id THEN
        -- Return zeros instead of data from another hospice
        RETURN QUERY SELECT 0::bigint, 0::bigint;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE i.issue_type = 'Death') as deaths_count,
        -- Admissions would come from patient table - count patients admitted this week
        (SELECT COUNT(*) FROM public.patients p
         WHERE p.hospice_id = p_hospice_id
         AND p.created_at >= p_week_start
         AND p.created_at <= p_week_end
         AND p.status = 'active') as admissions_count
    FROM public.issues i
    WHERE i.hospice_id = p_hospice_id
    AND i.created_at >= p_week_start
    AND i.created_at <= p_week_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_idg_summary_counts IS 'Fetches death and admission counts for IDG summary. SECURITY: Verifies user can only access their own hospice data.';
