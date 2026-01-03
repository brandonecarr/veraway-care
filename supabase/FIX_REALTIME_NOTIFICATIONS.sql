-- FIX: Enable filtered realtime subscriptions for notifications
-- The REPLICA IDENTITY must be set to FULL for realtime filters to work
-- Run this in Supabase SQL Editor

-- Set REPLICA IDENTITY to FULL for notifications table
-- This is required for filtered postgres_changes subscriptions
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Also set for messages table (Message Center)
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Set for conversations table
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Verify the settings
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('notifications', 'messages', 'conversations');
-- relreplident = 'f' means FULL (which is correct)
-- relreplident = 'd' means DEFAULT (which won't work with filters)
