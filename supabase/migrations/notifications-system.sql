CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    related_issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
    related_patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
    related_handoff_id uuid REFERENCES public.handoffs(id) ON DELETE CASCADE,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT false,
    in_app_enabled boolean DEFAULT true,
    notify_on_assignment boolean DEFAULT true,
    notify_on_mention boolean DEFAULT true,
    notify_on_issue_update boolean DEFAULT true,
    notify_on_handoff boolean DEFAULT true,
    notify_on_overdue boolean DEFAULT true,
    quiet_hours_start time,
    quiet_hours_end time,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_related_issue ON public.notifications(related_issue_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_notification_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_issue_id, related_patient_id)
        SELECT 
            NEW.assigned_to,
            'assignment',
            'New Issue Assigned',
            'Issue #' || NEW.issue_number || ' has been assigned to you',
            NEW.id,
            NEW.patient_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_notification_on_assignment ON public.issues;
CREATE TRIGGER trigger_create_notification_on_assignment
    AFTER INSERT OR UPDATE OF assigned_to ON public.issues
    FOR EACH ROW
    EXECUTE FUNCTION public.create_notification_on_assignment();

CREATE OR REPLACE FUNCTION public.create_notification_on_message()
RETURNS TRIGGER AS $$
DECLARE
    issue_record RECORD;
    mentioned_users uuid[];
BEGIN
    SELECT * INTO issue_record FROM public.issues WHERE id = NEW.issue_id;
    
    IF issue_record.assigned_to IS NOT NULL AND issue_record.assigned_to != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_issue_id, related_patient_id)
        VALUES (
            issue_record.assigned_to,
            'message',
            'New Message on Issue #' || issue_record.issue_number,
            substring(NEW.message, 1, 100),
            NEW.issue_id,
            issue_record.patient_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_notification_on_message ON public.issue_messages;
CREATE TRIGGER trigger_create_notification_on_message
    AFTER INSERT ON public.issue_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.create_notification_on_message();

CREATE OR REPLACE FUNCTION public.create_notification_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        IF NEW.reported_by IS NOT NULL AND NEW.reported_by != auth.uid() THEN
            INSERT INTO public.notifications (user_id, type, title, message, related_issue_id, related_patient_id)
            VALUES (
                NEW.reported_by,
                'status_change',
                'Issue Status Updated',
                'Issue #' || NEW.issue_number || ' status changed to ' || NEW.status,
                NEW.id,
                NEW.patient_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_notification_on_status_change ON public.issues;
CREATE TRIGGER trigger_create_notification_on_status_change
    AFTER UPDATE OF status ON public.issues
    FOR EACH ROW
    EXECUTE FUNCTION public.create_notification_on_status_change();
