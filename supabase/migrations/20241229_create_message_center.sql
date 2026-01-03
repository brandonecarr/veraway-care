-- Message Center Schema
-- Creates tables for real-time team messaging with patient chat auto-creation
-- Supports: patient chats, direct messages, and group chats

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('patient', 'direct', 'group')),
    name text, -- For group chats and patient chats; auto-generated for direct messages
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE, -- Only for patient type
    created_by uuid REFERENCES auth.users(id),
    last_message_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    last_message_preview text, -- First 100 chars of last message for list display
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Constraints
    CONSTRAINT patient_type_requires_patient_id CHECK (
        (type = 'patient' AND patient_id IS NOT NULL) OR
        (type != 'patient' AND patient_id IS NULL)
    ),
    -- Ensure only one conversation per patient
    CONSTRAINT unique_patient_conversation UNIQUE (patient_id)
);

COMMENT ON TABLE public.conversations IS 'Chat conversations for team communication';
COMMENT ON COLUMN public.conversations.type IS 'patient: facility-wide chat for a patient, direct: 1-on-1 chat, group: custom group chat';

-- =====================================================
-- CONVERSATION PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    left_at timestamp with time zone, -- NULL means still active
    last_read_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    is_muted boolean DEFAULT false,

    -- Unique constraint: user can only be active in a conversation once
    CONSTRAINT unique_active_participant UNIQUE NULLS NOT DISTINCT (conversation_id, user_id, left_at)
);

COMMENT ON TABLE public.conversation_participants IS 'Tracks which users are in which conversations';

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    content text NOT NULL,
    message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'attachment')),
    metadata jsonb DEFAULT '{}'::jsonb, -- For attachments, mentions, etc.
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.messages IS 'Chat messages within conversations';
COMMENT ON COLUMN public.messages.message_type IS 'text: regular message, system: auto-generated, attachment: file/image';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_facility_id ON public.conversations(facility_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON public.conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_is_archived ON public.conversations(is_archived);

-- Participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_active ON public.conversation_participants(user_id, left_at) WHERE left_at IS NULL;

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- =====================================================
-- AUTO-UPDATE TRIGGERS
-- =====================================================

-- Update conversations.updated_at on modification
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FACILITY ID AUTO-POPULATION
-- =====================================================

-- Auto-populate facility_id on conversations
CREATE OR REPLACE FUNCTION public.set_conversation_facility_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.facility_id IS NULL THEN
        NEW.facility_id := public.get_user_facility_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_conversation_facility_id_trigger ON public.conversations;
CREATE TRIGGER set_conversation_facility_id_trigger
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_facility_id();

-- =====================================================
-- UPDATE CONVERSATION ON NEW MESSAGE
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- =====================================================
-- AUTO-CREATE PATIENT CONVERSATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_patient_conversation()
RETURNS TRIGGER AS $$
DECLARE
    new_conversation_id uuid;
    staff_user RECORD;
    current_user_id uuid;
BEGIN
    -- Get current user id
    current_user_id := auth.uid();

    -- Create conversation for the patient
    INSERT INTO public.conversations (
        facility_id,
        type,
        name,
        patient_id,
        created_by
    ) VALUES (
        NEW.facility_id,
        'patient',
        NEW.first_name || ' ' || NEW.last_name || ' - Care Team',
        NEW.id,
        current_user_id
    ) RETURNING id INTO new_conversation_id;

    -- Add all staff members from the same facility as participants
    FOR staff_user IN
        SELECT DISTINCT u.id
        FROM public.users u
        INNER JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE u.facility_id = NEW.facility_id
        AND ur.role IN ('clinician', 'coordinator', 'after_hours', 'admin')
    LOOP
        INSERT INTO public.conversation_participants (
            conversation_id,
            user_id,
            role
        ) VALUES (
            new_conversation_id,
            staff_user.id,
            'member'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Create a system message announcing the conversation
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        message_type
    ) VALUES (
        new_conversation_id,
        NULL,
        'Care team conversation created for ' || NEW.first_name || ' ' || NEW.last_name,
        'system'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_patient_conversation_trigger ON public.patients;
CREATE TRIGGER create_patient_conversation_trigger
AFTER INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.create_patient_conversation();

-- =====================================================
-- AUTO-ADD NEW STAFF TO PATIENT CONVERSATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.add_staff_to_patient_conversations()
RETURNS TRIGGER AS $$
DECLARE
    user_facility_id uuid;
BEGIN
    -- Get the user's facility_id
    SELECT facility_id INTO user_facility_id
    FROM public.users
    WHERE id = NEW.user_id;

    -- When a new user_role is created with relevant role, add them to all patient conversations
    IF NEW.role IN ('clinician', 'coordinator', 'after_hours', 'admin') THEN
        INSERT INTO public.conversation_participants (conversation_id, user_id, role)
        SELECT c.id, NEW.user_id, 'member'
        FROM public.conversations c
        WHERE c.facility_id = user_facility_id
        AND c.type = 'patient'
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS add_staff_to_patient_conversations_trigger ON public.user_roles;
CREATE TRIGGER add_staff_to_patient_conversations_trigger
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.add_staff_to_patient_conversations();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can view conversations in their facility
-- Note: Participant filtering is done at application level to avoid RLS recursion
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations
FOR SELECT USING (
    facility_id = public.get_user_facility_id()
);

-- Conversations: Users can create conversations in their facility
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
FOR INSERT WITH CHECK (
    facility_id = public.get_user_facility_id() OR
    facility_id IS NULL -- Allow trigger to set it
);

-- Conversations: Users can update conversations in their facility
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations" ON public.conversations
FOR UPDATE USING (
    facility_id = public.get_user_facility_id()
);

-- Participants: Users can view participants of conversations in their facility
-- Simplified to avoid infinite recursion
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;
CREATE POLICY "Users can view conversation participants" ON public.conversation_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.facility_id = public.get_user_facility_id()
    )
);

-- Participants: Users can add participants to conversations in their facility
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add participants" ON public.conversation_participants
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_participants.conversation_id
        AND c.facility_id = public.get_user_facility_id()
    )
);

-- Participants: Users can update their own participant record (mute, etc.)
DROP POLICY IF EXISTS "Users can update own participant record" ON public.conversation_participants;
CREATE POLICY "Users can update own participant record" ON public.conversation_participants
FOR UPDATE USING (
    user_id = auth.uid()
);

-- Messages: Users can view messages in their conversations
DROP POLICY IF EXISTS "Users can view conversation messages" ON public.messages;
CREATE POLICY "Users can view conversation messages" ON public.messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
);

-- Messages: Users can send messages to their conversations
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
FOR INSERT WITH CHECK (
    (sender_id = auth.uid() OR sender_id IS NULL) AND -- Allow system messages
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
);

-- Messages: Users can update their own messages (edit)
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
FOR UPDATE USING (
    sender_id = auth.uid()
);

-- =====================================================
-- HELPER FUNCTION: Find or Create Direct Message
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_or_create_direct_message(other_user_id uuid)
RETURNS uuid AS $$
DECLARE
    existing_conversation_id uuid;
    new_conversation_id uuid;
    current_user_facility_id uuid;
BEGIN
    -- Get current user's facility
    current_user_facility_id := public.get_user_facility_id();

    -- Check if a direct message already exists between these two users
    SELECT c.id INTO existing_conversation_id
    FROM public.conversations c
    INNER JOIN public.conversation_participants cp1 ON c.id = cp1.conversation_id
    INNER JOIN public.conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.type = 'direct'
    AND c.facility_id = current_user_facility_id
    AND cp1.user_id = auth.uid() AND cp1.left_at IS NULL
    AND cp2.user_id = other_user_id AND cp2.left_at IS NULL
    LIMIT 1;

    IF existing_conversation_id IS NOT NULL THEN
        RETURN existing_conversation_id;
    END IF;

    -- Create new direct message conversation
    INSERT INTO public.conversations (
        facility_id,
        type,
        created_by
    ) VALUES (
        current_user_facility_id,
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
-- HELPER FUNCTION: Get Unread Count for Conversation
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_conversation_unread_count(conv_id uuid)
RETURNS integer AS $$
DECLARE
    unread_count integer;
    last_read timestamp with time zone;
BEGIN
    -- Get user's last read timestamp for this conversation
    SELECT cp.last_read_at INTO last_read
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conv_id
    AND cp.user_id = auth.uid()
    AND cp.left_at IS NULL;

    IF last_read IS NULL THEN
        RETURN 0;
    END IF;

    -- Count messages after last read
    SELECT COUNT(*) INTO unread_count
    FROM public.messages m
    WHERE m.conversation_id = conv_id
    AND m.created_at > last_read
    AND m.sender_id != auth.uid()
    AND m.is_deleted = false;

    RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_conversation_unread_count IS 'Returns the number of unread messages in a conversation for the current user';

-- =====================================================
-- GRANT PERMISSIONS TO AUTHENTICATED ROLE
-- =====================================================
-- RLS policies only filter rows AFTER the user has base table permissions
-- Without these grants, authenticated users cannot access the tables at all

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- Also grant to service_role for admin operations
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_participants TO service_role;
GRANT ALL ON public.messages TO service_role;
