-- Fix Dashboard Metrics to Filter by Facility
-- This updates the get_dashboard_metrics function to only count data from the user's facility

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
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
    user_facility_id uuid;
BEGIN
    -- Get the current user's facility_id
    user_facility_id := public.get_user_facility_id();

    -- If user has no facility, return empty metrics
    IF user_facility_id IS NULL THEN
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

    -- Total issues for this facility
    SELECT COUNT(*) INTO total_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id;

    -- Open issues (open or in_progress) for this facility
    SELECT COUNT(*) INTO open_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status IN ('open', 'in_progress');

    -- Overdue issues (older than 24 hours and not resolved) for this facility
    SELECT COUNT(*) INTO overdue_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status != 'resolved'
    AND created_at < NOW() - INTERVAL '24 hours';

    -- Resolved today for this facility
    SELECT COUNT(*) INTO resolved_today_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status = 'resolved'
    AND resolved_at >= CURRENT_DATE;

    -- Average resolution time (in hours) for this facility
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
        0
    ) INTO avg_resolution_hours
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status = 'resolved'
    AND resolved_at IS NOT NULL;

    -- Issues by type (only non-resolved) for this facility
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', issue_type,
            'count', count
        ) ORDER BY count DESC
    ) INTO issues_by_type_data
    FROM (
        SELECT issue_type, COUNT(*)::integer as count
        FROM public.issues
        WHERE facility_id = user_facility_id
        AND status != 'resolved'
        GROUP BY issue_type
    ) subquery;

    -- Clinician responsiveness for this facility only
    -- Include ALL users (coordinators and clinicians) who have worked on issues
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
            AND i.facility_id = user_facility_id
        WHERE u.facility_id = user_facility_id
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

COMMENT ON FUNCTION public.get_dashboard_metrics() IS 'Calculates all dashboard metrics for the current user''s facility only. Returns JSON object with metrics.';
