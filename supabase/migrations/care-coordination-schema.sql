CREATE TABLE IF NOT EXISTS public.patients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    mrn text UNIQUE NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date,
    admission_date timestamp with time zone,
    diagnosis text,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.issues (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_number serial UNIQUE NOT NULL,
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
    reported_by uuid REFERENCES auth.users(id),
    assigned_to uuid REFERENCES auth.users(id),
    issue_type text NOT NULL,
    description text,
    status text DEFAULT 'open',
    priority text DEFAULT 'normal',
    tags text[],
    resolved_at timestamp with time zone,
    resolved_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.issue_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.issue_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.handoffs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by uuid REFERENCES auth.users(id),
    shift_start timestamp with time zone NOT NULL,
    shift_end timestamp with time zone NOT NULL,
    notes text,
    tagged_issues uuid[],
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
    role text NOT NULL DEFAULT 'clinician',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS issues_patient_id_idx ON public.issues(patient_id);
CREATE INDEX IF NOT EXISTS issues_assigned_to_idx ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues(status);
CREATE INDEX IF NOT EXISTS issues_created_at_idx ON public.issues(created_at);
CREATE INDEX IF NOT EXISTS issue_messages_issue_id_idx ON public.issue_messages(issue_id);
CREATE INDEX IF NOT EXISTS issue_audit_log_issue_id_idx ON public.issue_audit_log(issue_id);
CREATE INDEX IF NOT EXISTS patients_mrn_idx ON public.patients(mrn);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_issues_updated_at ON public.issues;
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_issue_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
        VALUES (NEW.id, NEW.reported_by, 'created', jsonb_build_object('status', NEW.status, 'issue_type', NEW.issue_type));
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status != OLD.status THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
            VALUES (NEW.id, NEW.assigned_to, 'status_changed', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            INSERT INTO public.issue_audit_log (issue_id, user_id, action, details)
            VALUES (NEW.id, NEW.assigned_to, 'assigned', jsonb_build_object('assigned_to', NEW.assigned_to));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issue_audit_trigger ON public.issues;
CREATE TRIGGER issue_audit_trigger AFTER INSERT OR UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.create_issue_audit_entry();

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all patients" ON public.patients;
CREATE POLICY "Users can view all patients" ON public.patients
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
CREATE POLICY "Users can insert patients" ON public.patients
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
CREATE POLICY "Users can update patients" ON public.patients
FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view all issues" ON public.issues;
CREATE POLICY "Users can view all issues" ON public.issues
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create issues" ON public.issues;
CREATE POLICY "Users can create issues" ON public.issues
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update issues" ON public.issues;
CREATE POLICY "Users can update issues" ON public.issues
FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view issue messages" ON public.issue_messages;
CREATE POLICY "Users can view issue messages" ON public.issue_messages
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create issue messages" ON public.issue_messages;
CREATE POLICY "Users can create issue messages" ON public.issue_messages
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view audit log" ON public.issue_audit_log;
CREATE POLICY "Users can view audit log" ON public.issue_audit_log
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view handoffs" ON public.handoffs;
CREATE POLICY "Users can view handoffs" ON public.handoffs
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create handoffs" ON public.handoffs;
CREATE POLICY "Users can create handoffs" ON public.handoffs
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their role" ON public.user_roles;
CREATE POLICY "Users can view their role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert their role" ON public.user_roles;
CREATE POLICY "Users can insert their role" ON public.user_roles
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their role" ON public.user_roles;
CREATE POLICY "Users can update their role" ON public.user_roles
FOR UPDATE USING (auth.role() = 'authenticated');
