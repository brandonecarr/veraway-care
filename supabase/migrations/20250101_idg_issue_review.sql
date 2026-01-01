-- IDG Issue Review Functions
-- Auto-generates weekly issue list for IDG meetings
-- Issues are included if they meet ANY of these criteria:
-- 1. Unresolved after threshold hours (default 24)
-- 2. IDG-relevant issue types (Change in Condition, Death, Infection, etc.)
-- 3. High or Urgent priority

-- Main function to fetch IDG issues for a given week
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
    LEFT JOIN public.user_roles ur ON i.assigned_to = ur.user_id AND ur.facility_id = i.facility_id
    LEFT JOIN public.users reporter ON i.reported_by = reporter.id
    WHERE
        i.status IN ('open', 'in_progress')
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

-- Function to get audit actions for specific issues
CREATE OR REPLACE FUNCTION public.get_idg_issue_actions(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    actions jsonb
) AS $$
BEGIN
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
    WHERE a.issue_id = ANY(p_issue_ids)
    GROUP BY a.issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent messages as outstanding next steps
CREATE OR REPLACE FUNCTION public.get_idg_issue_messages(p_issue_ids uuid[])
RETURNS TABLE (
    issue_id uuid,
    messages jsonb
) AS $$
BEGIN
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
    WHERE m.issue_id = ANY(p_issue_ids)
    GROUP BY m.issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_idg_issues IS 'Fetches issues meeting IDG review criteria for a given week. Includes patient info, assignee job role, and IDG qualification reason.';
COMMENT ON FUNCTION public.get_idg_issue_actions IS 'Fetches audit log actions for specified issues, grouped by issue_id.';
COMMENT ON FUNCTION public.get_idg_issue_messages IS 'Fetches messages for specified issues as outstanding next steps, grouped by issue_id.';
