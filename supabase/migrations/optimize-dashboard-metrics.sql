-- Optimize Dashboard Metrics
-- Move metrics calculation from JavaScript to PostgreSQL for massive performance improvement

-- Enable pg_trgm extension for fuzzy text search (MUST BE FIRST)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- Dashboard Metrics Function
-- =====================================================

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
BEGIN
    -- Total issues
    SELECT COUNT(*) INTO total_issues_count
    FROM public.issues;

    -- Open issues (open or in_progress)
    SELECT COUNT(*) INTO open_issues_count
    FROM public.issues
    WHERE status IN ('open', 'in_progress');

    -- Overdue issues (older than 24 hours and not resolved)
    SELECT COUNT(*) INTO overdue_issues_count
    FROM public.issues
    WHERE status != 'resolved'
    AND created_at < NOW() - INTERVAL '24 hours';

    -- Resolved today
    SELECT COUNT(*) INTO resolved_today_count
    FROM public.issues
    WHERE status = 'resolved'
    AND resolved_at >= CURRENT_DATE;

    -- Average resolution time (in hours)
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
        0
    ) INTO avg_resolution_hours
    FROM public.issues
    WHERE status = 'resolved'
    AND resolved_at IS NOT NULL;

    -- Issues by type (only non-resolved)
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', issue_type,
            'count', count
        ) ORDER BY count DESC
    ) INTO issues_by_type_data
    FROM (
        SELECT issue_type, COUNT(*)::integer as count
        FROM public.issues
        WHERE status != 'resolved'
        GROUP BY issue_type
    ) subquery;

    -- Clinician responsiveness
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
        LEFT JOIN public.issues i ON i.assigned_to = u.id
        WHERE i.id IS NOT NULL
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

-- =====================================================
-- Additional Performance Indexes
-- =====================================================

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS issues_status_created_at_idx ON public.issues(status, created_at DESC);
CREATE INDEX IF NOT EXISTS issues_status_assigned_to_idx ON public.issues(status, assigned_to);
CREATE INDEX IF NOT EXISTS issues_resolved_at_idx ON public.issues(resolved_at) WHERE resolved_at IS NOT NULL;

-- Full-text search indexes for patient search
CREATE INDEX IF NOT EXISTS patients_name_trgm_idx ON public.patients USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_mrn_trgm_idx ON public.patients USING gin (mrn gin_trgm_ops);

-- Composite index for issue filtering
CREATE INDEX IF NOT EXISTS issues_organization_status_created_idx ON public.issues(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS patients_organization_status_idx ON public.patients(organization_id, status);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS issue_audit_log_organization_created_idx ON public.issue_audit_log(organization_id, created_at DESC);

-- Index for handoffs
CREATE INDEX IF NOT EXISTS handoffs_organization_created_idx ON public.handoffs(organization_id, created_at DESC);

COMMENT ON FUNCTION public.get_dashboard_metrics() IS 'Calculates all dashboard metrics in a single database query for optimal performance. Returns JSON object with metrics.';
