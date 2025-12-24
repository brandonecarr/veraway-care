-- Fix audit log to track the user who made the change, not the assigned user
-- The trigger now uses auth.uid() to get the current authenticated user

CREATE OR REPLACE FUNCTION public.create_issue_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
        VALUES (NEW.id, COALESCE(current_user_id, NEW.reported_by), 'created', jsonb_build_object('status', NEW.status, 'issue_type', NEW.issue_type));
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status != OLD.status THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
            VALUES (NEW.id, COALESCE(current_user_id, NEW.reported_by), 'status_changed', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
            VALUES (NEW.id, COALESCE(current_user_id, NEW.reported_by), 'assigned', jsonb_build_object('assigned_to', NEW.assigned_to));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS issue_audit_trigger ON public.issues;
CREATE TRIGGER issue_audit_trigger AFTER INSERT OR UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.create_issue_audit_entry();
