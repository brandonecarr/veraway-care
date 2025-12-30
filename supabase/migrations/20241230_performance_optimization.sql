-- Performance Optimization Migration
-- This migration:
-- 1. Updates foreign keys to public.users to enable Supabase joins
-- 2. Adds performance indexes for common queries
-- 3. Creates batch unread count function

-- ==============================================================================
-- PART 1: Update Foreign Keys to Enable Supabase Joins
-- ==============================================================================

-- Drop existing auth.users foreign key constraints on issues table
-- Note: We keep the data integrity by pointing to public.users instead
-- public.users is synced from auth.users via triggers

ALTER TABLE public.issues
  DROP CONSTRAINT IF EXISTS issues_reported_by_fkey,
  DROP CONSTRAINT IF EXISTS issues_assigned_to_fkey,
  DROP CONSTRAINT IF EXISTS issues_resolved_by_fkey;

-- Add foreign key constraints to public.users (enables Supabase joins)
ALTER TABLE public.issues
  ADD CONSTRAINT issues_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT issues_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop existing auth.users foreign key on issue_messages
ALTER TABLE public.issue_messages
  DROP CONSTRAINT IF EXISTS issue_messages_user_id_fkey;

-- Add foreign key to public.users
ALTER TABLE public.issue_messages
  ADD CONSTRAINT issue_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop existing auth.users foreign key on issue_audit_log
ALTER TABLE public.issue_audit_log
  DROP CONSTRAINT IF EXISTS issue_audit_log_user_id_fkey;

-- Add foreign key to public.users
ALTER TABLE public.issue_audit_log
  ADD CONSTRAINT issue_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop existing auth.users foreign key on handoffs
ALTER TABLE public.handoffs
  DROP CONSTRAINT IF EXISTS handoffs_created_by_fkey;

-- Add foreign key to public.users
ALTER TABLE public.handoffs
  ADD CONSTRAINT handoffs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Drop existing auth.users foreign key on user_roles
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Add foreign key to public.users
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop existing auth.users foreign key on notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Add foreign key to public.users (if notifications table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==============================================================================
-- PART 2: Add Performance Indexes
-- ==============================================================================
-- Note: Removed CONCURRENTLY as it cannot run inside transaction blocks
-- For production, you may want to run these separately with CONCURRENTLY

-- Index for conversations ordered by last_message_at (every Message Center load)
CREATE INDEX IF NOT EXISTS idx_conversations_facility_last_message
ON public.conversations(facility_id, last_message_at DESC);

-- Index for unread notifications lookup (notification center)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON public.notifications(user_id, created_at DESC) WHERE is_read = false;

-- Index for messages by conversation (message loading)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON public.messages(conversation_id, created_at DESC);

-- Composite index for issues filtering by facility and status (dashboard)
CREATE INDEX IF NOT EXISTS idx_issues_facility_status_created
ON public.issues(facility_id, status, created_at DESC);

-- Index for conversation participants lookup
CREATE INDEX IF NOT EXISTS idx_conv_participants_user
ON public.conversation_participants(user_id, conversation_id);

-- Index for conversation participants last_read_at (unread counts)
CREATE INDEX IF NOT EXISTS idx_conv_participants_last_read
ON public.conversation_participants(conversation_id, last_read_at);

-- ==============================================================================
-- PART 3: Batch Unread Count Function
-- ==============================================================================

-- Function to get unread counts for multiple conversations in a single query
-- This replaces O(n) queries with O(1)
CREATE OR REPLACE FUNCTION get_batch_unread_counts(
  p_user_id UUID,
  p_conversation_ids UUID[]
)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.conversation_id,
    COUNT(*)::BIGINT as unread_count
  FROM messages m
  INNER JOIN conversation_participants cp
    ON cp.conversation_id = m.conversation_id
    AND cp.user_id = p_user_id
  WHERE
    m.conversation_id = ANY(p_conversation_ids)
    AND m.created_at > cp.last_read_at
    AND (m.sender_id IS NULL OR m.sender_id != p_user_id)
  GROUP BY m.conversation_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_batch_unread_counts TO authenticated;

-- ==============================================================================
-- PART 4: Update Users RLS Policy for Joins
-- ==============================================================================

-- Allow authenticated users to read all users (needed for joins)
DROP POLICY IF EXISTS "Users can view all users for joins" ON public.users;
CREATE POLICY "Users can view all users for joins" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================================
-- PART 5: Verify Foreign Key Setup
-- ==============================================================================

-- This comment documents the expected FK relationships after migration:
-- issues.reported_by -> public.users(id)
-- issues.assigned_to -> public.users(id)
-- issues.resolved_by -> public.users(id)
-- issues.patient_id -> public.patients(id) (unchanged)
-- issue_messages.user_id -> public.users(id)
-- issue_audit_log.user_id -> public.users(id)
-- handoffs.created_by -> public.users(id)
-- user_roles.user_id -> public.users(id)
-- notifications.user_id -> public.users(id)
