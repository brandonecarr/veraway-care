-- Migration: Add last_activity_at column for overdue reset functionality
-- This column tracks when the last activity (update note) was added to an issue
-- The overdue timer resets based on this field instead of created_at

-- Add the last_activity_at column to issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone;

-- Initialize last_activity_at to created_at for existing issues
UPDATE public.issues
SET last_activity_at = created_at
WHERE last_activity_at IS NULL;

-- Set default for new issues
ALTER TABLE public.issues
ALTER COLUMN last_activity_at SET DEFAULT timezone('utc'::text, now());

-- Create a trigger to auto-set last_activity_at on issue creation
CREATE OR REPLACE FUNCTION public.set_issue_last_activity_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_activity_at IS NULL THEN
        NEW.last_activity_at := NEW.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_last_activity_at_trigger ON public.issues;
CREATE TRIGGER set_issue_last_activity_at_trigger
    BEFORE INSERT ON public.issues
    FOR EACH ROW
    EXECUTE FUNCTION public.set_issue_last_activity_at();

-- Update the dashboard metrics function to use last_activity_at for overdue calculation
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_user_id uuid)
RETURNS json AS $$
DECLARE
    user_facility_id uuid;
    total_issues_count integer;
    open_issues_count integer;
    overdue_issues_count integer;
    resolved_today_count integer;
    avg_resolution_hours numeric;
    issues_by_type json;
BEGIN
    -- Get user's facility
    SELECT facility_id INTO user_facility_id
    FROM public.users
    WHERE id = p_user_id;

    IF user_facility_id IS NULL THEN
        RETURN json_build_object(
            'totalIssues', 0,
            'openIssues', 0,
            'overdueIssues', 0,
            'resolvedToday', 0,
            'avgResolutionTime', 0,
            'issuesByType', '[]'::json
        );
    END IF;

    -- Total issues for this facility
    SELECT COUNT(*) INTO total_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id;

    -- Open issues for this facility
    SELECT COUNT(*) INTO open_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status IN ('open', 'in_progress');

    -- Overdue issues (last activity older than 24 hours and not resolved) for this facility
    -- Uses last_activity_at instead of created_at so the timer resets on updates
    SELECT COUNT(*) INTO overdue_issues_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status != 'resolved'
    AND COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '24 hours';

    -- Resolved today for this facility
    SELECT COUNT(*) INTO resolved_today_count
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status = 'resolved'
    AND resolved_at >= CURRENT_DATE;

    -- Average resolution time in hours for this facility
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
        0
    ) INTO avg_resolution_hours
    FROM public.issues
    WHERE facility_id = user_facility_id
    AND status = 'resolved'
    AND resolved_at IS NOT NULL;

    -- Issues by type for this facility
    SELECT COALESCE(json_agg(
        json_build_object('type', issue_type, 'count', cnt)
    ), '[]'::json) INTO issues_by_type
    FROM (
        SELECT issue_type, COUNT(*) as cnt
        FROM public.issues
        WHERE facility_id = user_facility_id
        AND status != 'resolved'
        GROUP BY issue_type
        ORDER BY cnt DESC
    ) t;

    RETURN json_build_object(
        'totalIssues', total_issues_count,
        'openIssues', open_issues_count,
        'overdueIssues', overdue_issues_count,
        'resolvedToday', resolved_today_count,
        'avgResolutionTime', ROUND(avg_resolution_hours::numeric, 1),
        'issuesByType', issues_by_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO authenticated;
