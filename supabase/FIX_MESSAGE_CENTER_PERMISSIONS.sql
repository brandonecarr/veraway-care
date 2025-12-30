-- =====================================================
-- FIX MESSAGE CENTER PERMISSIONS
-- =====================================================
-- Run this if you already applied the message_center migration
-- but are getting "You do not have permission" errors
--
-- The original migration was missing GRANT statements.
-- RLS policies only filter rows AFTER the user has base table permissions.
-- =====================================================

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- Grant all permissions to service_role for admin operations
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_participants TO service_role;
GRANT ALL ON public.messages TO service_role;

-- Verify the grants were applied
SELECT
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('conversations', 'conversation_participants', 'messages')
AND grantee IN ('authenticated', 'service_role')
ORDER BY table_name, grantee;
