-- QUICK APPLY: Enable Realtime Notifications
-- Run this in Supabase SQL Editor to enable realtime notifications immediately
-- This is required for notifications to update in real-time without page refresh

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Also enable realtime for messages (Message Center)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Enable realtime for conversations
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Enable realtime for conversation_participants
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Verify the tables are in the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
