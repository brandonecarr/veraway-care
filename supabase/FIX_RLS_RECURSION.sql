-- =====================================================
-- FIX RLS INFINITE RECURSION
-- =====================================================
-- The original conversation_participants SELECT policy caused infinite recursion
-- because it queried conversation_participants from within itself.
--
-- This fix simplifies the policies to avoid recursion while maintaining security.
-- =====================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;

-- Participants: Users can view participants of conversations in their facility
-- Simplified to avoid recursion - just checks if conversation is in user's facility
CREATE POLICY "Users can view conversation participants" ON public.conversation_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.facility_id = public.get_user_facility_id()
    )
);

-- Participants: Users can add participants to conversations in their facility
-- For direct messages, group chats, and patient chats
CREATE POLICY "Users can add participants" ON public.conversation_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.facility_id = public.get_user_facility_id()
    )
);

-- Also need to fix the conversations SELECT policy which queries conversation_participants
-- This can cause issues when conversation_participants policy queries conversations
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;

-- Conversations: Users can view conversations in their facility
-- The participant check will be done at the application level or via a separate query
CREATE POLICY "Users can view their conversations" ON public.conversations
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

-- Conversations: Users can update conversations in their facility
CREATE POLICY "Users can update their conversations" ON public.conversations
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

-- Verify policies are in place
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('conversations', 'conversation_participants', 'messages')
ORDER BY tablename, policyname;
