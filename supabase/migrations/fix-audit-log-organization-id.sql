-- Fix audit log trigger to properly inherit facility_id from the issue
-- The issue is that when audit log entries are created via trigger,
-- auth.uid() may not be available, causing get_user_facility_id() to fail.
-- Instead, we should inherit the facility_id from the issue being modified.

-- Update the audit log creation trigger to include facility_id from the issue
CREATE OR REPLACE FUNCTION public.create_issue_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, facility_id)
        VALUES (
            NEW.id,
            COALESCE(current_user_id, NEW.reported_by),
            'created',
            jsonb_build_object('status', NEW.status, 'issue_type', NEW.issue_type),
            NEW.facility_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status != OLD.status THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, facility_id)
            VALUES (
                NEW.id,
                COALESCE(current_user_id, NEW.reported_by),
                'status_changed',
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
                NEW.facility_id
            );
        END IF;
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details, facility_id)
            VALUES (
                NEW.id,
                COALESCE(current_user_id, NEW.reported_by),
                'assigned',
                jsonb_build_object('assigned_to', NEW.assigned_to),
                NEW.facility_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the set_audit_log_facility_id trigger to get facility from the issue if not set
CREATE OR REPLACE FUNCTION public.set_audit_log_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    -- First try to get facility_id from the related issue
    IF NEW.facility_id IS NULL AND NEW.issue_id IS NOT NULL THEN
        SELECT facility_id INTO NEW.facility_id
        FROM public.issues
        WHERE id = NEW.issue_id;
    END IF;

    -- Fallback to user's facility if still null
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix any existing audit log entries that are missing facility_id
-- by looking up the facility from their related issue
UPDATE public.issue_audit_log ial
SET facility_id = i.facility_id
FROM public.issues i
WHERE ial.issue_id = i.id
AND ial.facility_id IS NULL
AND i.facility_id IS NOT NULL;

-- For any remaining entries without an issue_id, try to use the user's facility
UPDATE public.issue_audit_log ial
SET facility_id = u.facility_id
FROM public.users u
WHERE ial.user_id = u.id
AND ial.facility_id IS NULL
AND u.facility_id IS NOT NULL;
