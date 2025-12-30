-- Enable Supabase Realtime for notifications table
-- This is required for postgres_changes to work

-- Add notifications table to the supabase_realtime publication
-- This enables realtime subscriptions for INSERT, UPDATE, and DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Also add messages table for message center realtime (if not already added)
-- Ignore error if already added
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
END $$;

-- Ensure proper permissions are granted for realtime to work
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;
