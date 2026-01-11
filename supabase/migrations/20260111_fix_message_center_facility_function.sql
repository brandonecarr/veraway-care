-- Fix Message Center: Create get_user_facility_id() function and update RLS policies
-- The message center code references facility_id but the database uses hospice_id
-- This creates the alias function and updates all RLS policies to use hospice_id

-- =====================================================
-- STEP 1: Create get_user_facility_id() as alias for hospice_id
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_facility_id()
RETURNS uuid AS $$
DECLARE
    h_id uuid;
BEGIN
    SELECT hospice_id INTO h_id
    FROM public.users
    WHERE id = auth.uid();

    RETURN h_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_facility_id() IS 'Returns the hospice_id of the current authenticated user (alias for facility terminology)';

-- =====================================================
-- STEP 2: Create user_belongs_to_facility() as alias
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_belongs_to_facility(fac_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND hospice_id = fac_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.user_belongs_to_facility(uuid) IS 'Checks if the current user belongs to the specified hospice (alias for facility terminology)';

-- =====================================================
-- STEP 3: Ensure conversations table has hospice_id
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
        -- Check if hospice_id column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'conversations'
                       AND column_name = 'hospice_id'
                       AND table_schema = 'public') THEN
            -- Add the column referencing hospices table
            ALTER TABLE public.conversations
            ADD COLUMN hospice_id uuid REFERENCES public.hospices(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- =====================================================
-- STEP 4: Update conversation trigger to use hospice_id
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_conversation_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hospice_id IS NULL THEN
        NEW.hospice_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Update RLS policies to use hospice_id
-- =====================================================

-- Conversations: Users can view conversations in their hospice
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations
FOR SELECT USING (
    hospice_id = public.get_user_facility_id()
);

-- Conversations: Users can create conversations in their hospice
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
FOR INSERT WITH CHECK (
    hospice_id = public.get_user_facility_id() OR
    hospice_id IS NULL -- Allow trigger to set it
);

-- Conversations: Users can update conversations in their hospice
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations" ON public.conversations
FOR UPDATE USING (
    hospice_id = public.get_user_facility_id()
);

-- Participants: Users can view participants of conversations in their hospice
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
CREATE POLICY "Users can view conversation participants" ON public.conversation_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.hospice_id = public.get_user_facility_id()
    )
);

-- Participants: Users can add participants to conversations in their hospice
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add participants" ON public.conversation_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.hospice_id = public.get_user_facility_id()
    )
);

-- =====================================================
-- STEP 6: Update find_or_create_direct_message function
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_or_create_direct_message(other_user_id uuid)
RETURNS uuid AS $$
DECLARE
    existing_conversation_id uuid;
    new_conversation_id uuid;
    current_user_hospice_id uuid;
BEGIN
    -- Get current user's hospice
    current_user_hospice_id := public.get_user_facility_id();

    -- Check if a direct message already exists between these two users
    SELECT c.id INTO existing_conversation_id
    FROM public.conversations c
    INNER JOIN public.conversation_participants cp1 ON c.id = cp1.conversation_id
    INNER JOIN public.conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.type = 'direct'
    AND c.hospice_id = current_user_hospice_id
    AND cp1.user_id = auth.uid() AND cp1.left_at IS NULL
    AND cp2.user_id = other_user_id AND cp2.left_at IS NULL
    LIMIT 1;

    IF existing_conversation_id IS NOT NULL THEN
        RETURN existing_conversation_id;
    END IF;

    -- Create new direct message conversation
    INSERT INTO public.conversations (
        hospice_id,
        type,
        created_by
    ) VALUES (
        current_user_hospice_id,
        'direct',
        auth.uid()
    ) RETURNING id INTO new_conversation_id;

    -- Add both participants
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES
        (new_conversation_id, auth.uid(), 'member'),
        (new_conversation_id, other_user_id, 'member');

    RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.find_or_create_direct_message IS 'Finds existing or creates new direct message conversation between current user and specified user';

-- =====================================================
-- DONE
-- =====================================================

-- Now the message center should work because:
-- 1. The get_user_facility_id() function exists and returns the user's hospice_id
-- 2. The conversations table uses hospice_id
-- 3. All RLS policies reference hospice_id instead of facility_id
-- 4. The find_or_create_direct_message function uses hospice_id
