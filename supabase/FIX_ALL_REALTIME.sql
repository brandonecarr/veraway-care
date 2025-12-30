-- COMPREHENSIVE FIX: Enable Realtime for All Tables
-- Run this entire script in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add tables to supabase_realtime publication
-- =====================================================

-- Notifications
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Messages
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversations
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversation participants
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Issues (for issue realtime updates)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- STEP 2: Set REPLICA IDENTITY to FULL
-- Required for filtered realtime subscriptions
-- =====================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.issues REPLICA IDENTITY FULL;

-- =====================================================
-- STEP 3: Grant SELECT permissions for realtime
-- =====================================================

GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.issues TO authenticated;

-- Also grant INSERT/UPDATE for messages (needed for sending)
GRANT INSERT, UPDATE ON public.messages TO authenticated;
GRANT INSERT, UPDATE ON public.conversation_participants TO authenticated;

-- =====================================================
-- STEP 4: Verify the setup
-- =====================================================

-- Check which tables are in the publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Check REPLICA IDENTITY settings (f = FULL, d = DEFAULT)
SELECT c.relname as table_name,
       CASE c.relreplident
           WHEN 'd' THEN 'DEFAULT (needs fix)'
           WHEN 'f' THEN 'FULL (correct)'
           WHEN 'n' THEN 'NOTHING'
           WHEN 'i' THEN 'INDEX'
       END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN ('notifications', 'messages', 'conversations', 'conversation_participants', 'issues');
