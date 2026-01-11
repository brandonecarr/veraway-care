-- Message Center Performance Optimization Migration
-- Adds indexes and optimized functions for scaling to thousands of messages

-- =====================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite index for efficient unread count queries
CREATE INDEX IF NOT EXISTS idx_messages_unread_count
ON public.messages(conversation_id, created_at, sender_id)
WHERE is_deleted = false;

-- Index for faster message pagination with cursor
CREATE INDEX IF NOT EXISTS idx_messages_pagination
ON public.messages(conversation_id, created_at DESC, id);

-- Index for participant lookup by user (conversations list)
CREATE INDEX IF NOT EXISTS idx_participants_user_active
ON public.conversation_participants(user_id, conversation_id)
WHERE left_at IS NULL;

-- Index for last_read_at updates
CREATE INDEX IF NOT EXISTS idx_participants_last_read
ON public.conversation_participants(conversation_id, user_id, last_read_at)
WHERE left_at IS NULL;

-- Covering index for conversations list query
CREATE INDEX IF NOT EXISTS idx_conversations_list
ON public.conversations(hospice_id, is_archived, last_message_at DESC)
INCLUDE (id, type, name, patient_id, last_message_preview);

-- =====================================================
-- OPTIMIZED BATCH UNREAD COUNT FUNCTION
-- =====================================================
-- Returns unread counts for multiple conversations in a single query
-- Much more efficient than calling get_conversation_unread_count per conversation

-- Drop any existing versions to avoid conflicts
DROP FUNCTION IF EXISTS public.get_batch_unread_counts(uuid[]);

CREATE OR REPLACE FUNCTION public.get_batch_unread_counts(conversation_ids uuid[])
RETURNS TABLE(conversation_id uuid, unread_count bigint) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.conversation_id,
        COUNT(m.id)::bigint AS unread_count
    FROM public.conversation_participants cp
    LEFT JOIN public.messages m ON m.conversation_id = cp.conversation_id
        AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
        AND m.sender_id != auth.uid()
        AND m.is_deleted = false
    WHERE cp.user_id = auth.uid()
        AND cp.left_at IS NULL
        AND cp.conversation_id = ANY(conversation_ids)
    GROUP BY cp.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_batch_unread_counts IS 'Efficiently returns unread counts for multiple conversations in a single query';

-- =====================================================
-- OPTIMIZED TOTAL UNREAD COUNT FUNCTION
-- =====================================================
-- Returns total unread message count across all conversations for the navbar badge

-- Drop any existing versions to avoid conflicts
DROP FUNCTION IF EXISTS public.get_total_unread_count();

CREATE OR REPLACE FUNCTION public.get_total_unread_count()
RETURNS bigint AS $$
DECLARE
    total bigint;
BEGIN
    SELECT COALESCE(SUM(cnt), 0)::bigint INTO total
    FROM (
        SELECT COUNT(m.id) AS cnt
        FROM public.conversation_participants cp
        INNER JOIN public.conversations c ON c.id = cp.conversation_id
        LEFT JOIN public.messages m ON m.conversation_id = cp.conversation_id
            AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
            AND m.sender_id != auth.uid()
            AND m.is_deleted = false
        WHERE cp.user_id = auth.uid()
            AND cp.left_at IS NULL
            AND c.is_archived = false
        GROUP BY cp.conversation_id
    ) sub;

    RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_total_unread_count IS 'Returns total unread message count for the current user across all active conversations';

-- =====================================================
-- OPTIMIZED CONVERSATIONS LIST FUNCTION
-- =====================================================
-- Returns conversations with unread counts in a single efficient query

-- Drop any existing versions to avoid conflicts
DROP FUNCTION IF EXISTS public.get_user_conversations(boolean, text);

CREATE OR REPLACE FUNCTION public.get_user_conversations(
    include_archived boolean DEFAULT false,
    conversation_type text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    hospice_id uuid,
    type text,
    name text,
    patient_id uuid,
    created_by uuid,
    last_message_at timestamptz,
    last_message_preview text,
    is_archived boolean,
    created_at timestamptz,
    updated_at timestamptz,
    unread_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.hospice_id,
        c.type,
        c.name,
        c.patient_id,
        c.created_by,
        c.last_message_at,
        c.last_message_preview,
        c.is_archived,
        c.created_at,
        c.updated_at,
        COALESCE(unread.cnt, 0)::bigint AS unread_count
    FROM public.conversations c
    INNER JOIN public.conversation_participants cp ON cp.conversation_id = c.id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    LEFT JOIN LATERAL (
        SELECT COUNT(m.id) AS cnt
        FROM public.messages m
        WHERE m.conversation_id = c.id
            AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
            AND m.sender_id != auth.uid()
            AND m.is_deleted = false
    ) unread ON true
    WHERE c.hospice_id = public.get_user_facility_id()
        AND (include_archived OR c.is_archived = false)
        AND (conversation_type IS NULL OR c.type = conversation_type)
    ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_conversations IS 'Returns all conversations for the current user with unread counts efficiently computed';

-- =====================================================
-- GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_batch_unread_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_unread_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(boolean, text) TO authenticated;
