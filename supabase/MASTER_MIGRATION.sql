-- Combined migration file that includes all necessary database setup

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY NOT NULL,
    avatar_url text,
    user_id text UNIQUE,
    token_identifier text NOT NULL,
    subscription text,
    credits text,
    image text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone,
    email text,
    name text,
    full_name text
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text REFERENCES public.users(user_id),
    stripe_id text UNIQUE,
    price_id text,
    stripe_price_id text,
    currency text,
    interval text,
    status text,
    current_period_start bigint,
    current_period_end bigint,
    cancel_at_period_end boolean,
    amount bigint,
    started_at bigint,
    ends_at bigint,
    ended_at bigint,
    canceled_at bigint,
    customer_cancellation_reason text,
    customer_cancellation_comment text,
    metadata jsonb,
    custom_field_data jsonb,
    customer_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_id_idx ON public.subscriptions(stripe_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text NOT NULL,
    type text NOT NULL,
    stripe_event_id text,
    data jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    modified_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS webhook_events_type_idx ON public.webhook_events(type);
CREATE INDEX IF NOT EXISTS webhook_events_stripe_event_id_idx ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx ON public.webhook_events(event_type);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
    -- Check if the policy for users exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'Users can view own data'
    ) THEN
        -- Create policy to allow users to see only their own data
        EXECUTE 'CREATE POLICY "Users can view own data" ON public.users
                FOR SELECT USING (auth.uid()::text = user_id)';
    END IF;

    -- Check if the policy for subscriptions exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Users can view own subscriptions'
    ) THEN
        -- Create policy for subscriptions
        EXECUTE 'CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
                FOR SELECT USING (auth.uid()::text = user_id)';
    END IF;
END
$$;

-- Create a function that will be triggered when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    user_id,
    email,
    name,
    full_name,
    avatar_url,
    token_identifier,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id::text,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a new user is added to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the function to handle user updates as well
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = NEW.raw_user_meta_data->>'name',
    full_name = NEW.raw_user_meta_data->>'full_name',
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NEW.updated_at
  WHERE user_id = NEW.id::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a user is updated in auth.users
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update(); CREATE TABLE IF NOT EXISTS public.patients (
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
-- Create push_subscriptions table for storing browser push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  subscription_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_push_subscriptions_timestamp ON push_subscriptions;
CREATE TRIGGER update_push_subscriptions_timestamp
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();
-- Create function to queue push notifications when a notification is created
-- This will be called by triggers on the notifications table

CREATE OR REPLACE FUNCTION queue_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  pref_record RECORD;
  priority_level TEXT;
BEGIN
  -- Get user's notification preferences
  SELECT push_enabled INTO pref_record
  FROM notification_preferences
  WHERE user_id = NEW.user_id;

  -- Only proceed if user has push notifications enabled
  IF pref_record.push_enabled THEN
    -- Determine priority based on notification type
    priority_level := CASE 
      WHEN NEW.type = 'assignment' AND NEW.metadata->>'priority' = 'urgent' THEN 'urgent'
      WHEN NEW.type = 'status_change' AND NEW.metadata->>'new_status' = 'overdue' THEN 'critical'
      WHEN NEW.type = 'assignment' THEN 'normal'
      WHEN NEW.type = 'message' THEN 'normal'
      ELSE 'normal'
    END;

    -- Insert into a queue table that will be processed by the API
    -- We can't directly send HTTP requests from PostgreSQL functions
    -- So we'll use a trigger on the notifications table to send via API
    -- For now, we'll just ensure the notification has the metadata needed
    
    -- Update the notification with push metadata
    UPDATE notifications
    SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                   jsonb_build_object(
                     'push_priority', priority_level,
                     'push_queued', true,
                     'push_queued_at', NOW()
                   )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to queue push notifications
DROP TRIGGER IF EXISTS trigger_queue_push_notification ON notifications;
CREATE TRIGGER trigger_queue_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_notification();
-- Multi-Tenancy Migration
-- This migration adds organization-level data isolation for enterprise SaaS deployment

-- =====================================================
-- STEP 1: Create organizations table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL, -- URL-friendly identifier
    settings jsonb DEFAULT '{}'::jsonb, -- Organization-specific settings
    subscription_tier text DEFAULT 'free', -- free, pro, enterprise
    max_users integer DEFAULT 10,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS organizations_slug_idx ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_is_active_idx ON public.organizations(is_active);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Add organization_id to existing tables
-- =====================================================

-- Add organization_id to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON public.users(organization_id);

-- Add organization_id to patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS patients_organization_id_idx ON public.patients(organization_id);

-- Add organization_id to issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issues_organization_id_idx ON public.issues(organization_id);

-- Add organization_id to issue_messages table
ALTER TABLE public.issue_messages
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_messages_organization_id_idx ON public.issue_messages(organization_id);

-- Add organization_id to issue_audit_log table
ALTER TABLE public.issue_audit_log
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS issue_audit_log_organization_id_idx ON public.issue_audit_log(organization_id);

-- Add organization_id to handoffs table
ALTER TABLE public.handoffs
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS handoffs_organization_id_idx ON public.handoffs(organization_id);

-- Add organization_id to user_roles table
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_organization_id_idx ON public.user_roles(organization_id);

-- =====================================================
-- STEP 3: Create helper functions
-- =====================================================

-- Function to get current user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid AS $$
DECLARE
    org_id uuid;
BEGIN
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE id = auth.uid();

    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: Update triggers to auto-populate organization_id
-- =====================================================

-- Trigger function to auto-populate organization_id on issues
CREATE OR REPLACE FUNCTION public.set_issue_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_organization_id_trigger ON public.issues;
CREATE TRIGGER set_issue_organization_id_trigger
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.set_issue_organization_id();

-- Trigger function to auto-populate organization_id on patients
CREATE OR REPLACE FUNCTION public.set_patient_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_patient_organization_id_trigger ON public.patients;
CREATE TRIGGER set_patient_organization_id_trigger
BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_organization_id();

-- Trigger function to auto-populate organization_id on issue_messages
CREATE OR REPLACE FUNCTION public.set_issue_message_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_issue_message_organization_id_trigger ON public.issue_messages;
CREATE TRIGGER set_issue_message_organization_id_trigger
BEFORE INSERT ON public.issue_messages
FOR EACH ROW EXECUTE FUNCTION public.set_issue_message_organization_id();

-- Trigger function to auto-populate organization_id on issue_audit_log
CREATE OR REPLACE FUNCTION public.set_audit_log_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_audit_log_organization_id_trigger ON public.issue_audit_log;
CREATE TRIGGER set_audit_log_organization_id_trigger
BEFORE INSERT ON public.issue_audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_organization_id();

-- Trigger function to auto-populate organization_id on handoffs
CREATE OR REPLACE FUNCTION public.set_handoff_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := public.get_user_organization_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_handoff_organization_id_trigger ON public.handoffs;
CREATE TRIGGER set_handoff_organization_id_trigger
BEFORE INSERT ON public.handoffs
FOR EACH ROW EXECUTE FUNCTION public.set_handoff_organization_id();

-- =====================================================
-- STEP 5: Update RLS policies for multi-tenancy
-- =====================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
CREATE POLICY "Users can view their organization" ON public.organizations
FOR SELECT USING (
    id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update their organization" ON public.organizations;
CREATE POLICY "Users can update their organization" ON public.organizations
FOR UPDATE USING (
    id = public.get_user_organization_id()
);

-- Users policies (allow viewing users in same organization)
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can view organization members" ON public.users;
CREATE POLICY "Users can view organization members" ON public.users
FOR SELECT USING (
    organization_id = public.get_user_organization_id() OR
    id = auth.uid()
);

-- Patients policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view all patients" ON public.patients;
CREATE POLICY "Users can view organization patients" ON public.patients
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can insert patients" ON public.patients;
CREATE POLICY "Users can insert organization patients" ON public.patients
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update patients" ON public.patients;
CREATE POLICY "Users can update organization patients" ON public.patients
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete patients" ON public.patients;
CREATE POLICY "Users can delete organization patients" ON public.patients
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- Issues policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view all issues" ON public.issues;
CREATE POLICY "Users can view organization issues" ON public.issues
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create issues" ON public.issues;
CREATE POLICY "Users can create organization issues" ON public.issues
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update issues" ON public.issues;
CREATE POLICY "Users can update organization issues" ON public.issues
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete issues" ON public.issues;
CREATE POLICY "Users can delete organization issues" ON public.issues
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- Issue messages policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view issue messages" ON public.issue_messages;
CREATE POLICY "Users can view organization issue messages" ON public.issue_messages
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create issue messages" ON public.issue_messages;
CREATE POLICY "Users can create organization issue messages" ON public.issue_messages
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

-- Issue audit log policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view audit log" ON public.issue_audit_log;
CREATE POLICY "Users can view organization audit log" ON public.issue_audit_log
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

-- Handoffs policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view handoffs" ON public.handoffs;
CREATE POLICY "Users can view organization handoffs" ON public.handoffs
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can create handoffs" ON public.handoffs;
CREATE POLICY "Users can create organization handoffs" ON public.handoffs
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update handoffs" ON public.handoffs;
CREATE POLICY "Users can update organization handoffs" ON public.handoffs
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can delete handoffs" ON public.handoffs;
CREATE POLICY "Users can delete organization handoffs" ON public.handoffs
FOR DELETE USING (
    organization_id = public.get_user_organization_id()
);

-- User roles policies (organization-scoped)
DROP POLICY IF EXISTS "Users can view their role" ON public.user_roles;
CREATE POLICY "Users can view organization roles" ON public.user_roles
FOR SELECT USING (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can insert their role" ON public.user_roles;
CREATE POLICY "Users can insert organization roles" ON public.user_roles
FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update their role" ON public.user_roles;
CREATE POLICY "Users can update organization roles" ON public.user_roles
FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
);

-- =====================================================
-- STEP 6: Create organization management functions
-- =====================================================

-- Function to create a new organization with first user as admin
CREATE OR REPLACE FUNCTION public.create_organization(
    org_name text,
    org_slug text
)
RETURNS uuid AS $$
DECLARE
    new_org_id uuid;
BEGIN
    -- Insert new organization
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO new_org_id;

    -- Update current user's organization
    UPDATE public.users
    SET organization_id = new_org_id
    WHERE id = auth.uid();

    -- Set user role as coordinator (admin)
    INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (auth.uid(), 'coordinator', new_org_id)
    ON CONFLICT (user_id) DO UPDATE
    SET role = 'coordinator', organization_id = new_org_id;

    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Add updated_at trigger for organizations
-- =====================================================

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 8: Migration note
-- =====================================================

-- IMPORTANT: After running this migration, you need to:
-- 1. Create at least one organization
-- 2. Assign all existing users to an organization
-- 3. Update existing data to have organization_id set
--
-- For development/testing, you can run:
-- INSERT INTO public.organizations (name, slug) VALUES ('Demo Organization', 'demo-org');
-- UPDATE public.users SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.patients SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issues SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issue_messages SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.issue_audit_log SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.handoffs SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- UPDATE public.user_roles SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'demo-org' LIMIT 1);
-- Seed Default Organization
-- This migration creates a default organization and assigns all existing data to it
-- Run this AFTER add-multi-tenancy.sql migration

DO $$
DECLARE
    default_org_id uuid;
    existing_org_count integer;
BEGIN
    -- Check if any organizations already exist
    SELECT COUNT(*) INTO existing_org_count FROM public.organizations;

    -- Only create default organization if none exists
    IF existing_org_count = 0 THEN
        -- Create default organization
        INSERT INTO public.organizations (name, slug, subscription_tier, max_users, is_active)
        VALUES ('Default Organization', 'default-org', 'enterprise', 999, true)
        RETURNING id INTO default_org_id;

        RAISE NOTICE 'Created default organization with ID: %', default_org_id;

        -- Assign all existing users to default organization
        UPDATE public.users
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing users to default organization';

        -- Assign all existing patients to default organization
        UPDATE public.patients
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing patients to default organization';

        -- Assign all existing issues to default organization
        UPDATE public.issues
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing issues to default organization';

        -- Assign all existing issue messages to default organization
        UPDATE public.issue_messages
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing issue messages to default organization';

        -- Assign all existing audit log entries to default organization
        UPDATE public.issue_audit_log
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing audit log entries to default organization';

        -- Assign all existing handoffs to default organization
        UPDATE public.handoffs
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing handoffs to default organization';

        -- Assign all existing user roles to default organization
        UPDATE public.user_roles
        SET organization_id = default_org_id
        WHERE organization_id IS NULL;

        RAISE NOTICE 'Assigned existing user roles to default organization';

        RAISE NOTICE 'Default organization migration completed successfully';
    ELSE
        RAISE NOTICE 'Organizations already exist, skipping default organization creation';
    END IF;
END $$;
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
ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_handoffs_is_archived ON handoffs(is_archived);

DROP POLICY IF EXISTS "Users can update handoffs" ON handoffs;
CREATE POLICY "Users can update handoffs" ON handoffs
  FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow trigger to insert audit log" ON public.issue_audit_log;
CREATE POLICY "Allow trigger to insert audit log" ON public.issue_audit_log
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert audit log" ON public.issue_audit_log;
CREATE POLICY "Users can insert audit log" ON public.issue_audit_log
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
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
-- Advanced Analytics Functions for Phase 11

-- 1. Response Time Trends (daily average response time)
CREATE OR REPLACE FUNCTION get_response_time_trends(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  avg_response_time NUMERIC,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(i.updated_at, NOW()) - i.created_at)) / 3600)::numeric, 2) as avg_response_time,
    COUNT(*)::BIGINT as count
  FROM issues i
  WHERE i.created_at >= start_date 
    AND i.created_at <= end_date
  GROUP BY DATE(i.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- 2. Resolution Velocity (daily resolved count and avg time)
CREATE OR REPLACE FUNCTION get_resolution_velocity(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  resolved BIGINT,
  avg_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.resolved_at) as date,
    COUNT(*)::BIGINT as resolved,
    ROUND(AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600)::numeric, 2) as avg_hours
  FROM issues i
  WHERE i.status = 'resolved'
    AND i.resolved_at IS NOT NULL
    AND i.resolved_at >= start_date 
    AND i.resolved_at <= end_date
  GROUP BY DATE(i.resolved_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- 3. Clinician Workload Heatmap
CREATE OR REPLACE FUNCTION get_clinician_workload()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  assigned_count BIGINT,
  resolved_count BIGINT,
  overdue_count BIGINT,
  avg_completion_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    COALESCE(u.name, u.email) as name,
    u.email,
    COUNT(DISTINCT CASE WHEN i.status IN ('open', 'in_progress') THEN i.id END)::BIGINT as assigned_count,
    COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.id END)::BIGINT as resolved_count,
    COUNT(DISTINCT CASE WHEN i.status = 'overdue' THEN i.id END)::BIGINT as overdue_count,
    COALESCE(
      ROUND(AVG(
        CASE 
          WHEN i.status = 'resolved' AND i.resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600
        END
      )::numeric, 2),
      0
    ) as avg_completion_time
  FROM users u
  LEFT JOIN issues i ON i.assigned_to = u.id
  WHERE u.role IN ('clinician', 'coordinator')
  GROUP BY u.id, u.name, u.email
  HAVING COUNT(i.id) > 0
  ORDER BY assigned_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Issue Type Distribution Over Time
CREATE OR REPLACE FUNCTION get_issue_type_distribution(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    jsonb_agg(
      jsonb_build_object(
        'type', i.issue_type,
        'count', type_count
      )
      ORDER BY type_count DESC
    ) as distribution
  FROM (
    SELECT 
      DATE(created_at) as created_date,
      issue_type,
      COUNT(*)::INTEGER as type_count
    FROM issues
    WHERE created_at >= start_date 
      AND created_at <= end_date
    GROUP BY DATE(created_at), issue_type
  ) i
  GROUP BY DATE(i.created_date)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;
