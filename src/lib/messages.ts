import { createClient } from '../../supabase/server';
import type {
  Conversation,
  ConversationWithDetails,
  Message,
  MessageWithSender,
  ConversationParticipant,
  User,
} from '@/types/messages';

/**
 * Get all conversations for the current user
 */
export async function getConversations(options?: {
  includeArchived?: boolean;
  type?: 'patient' | 'direct' | 'group';
}): Promise<ConversationWithDetails[]> {
  const supabase = await createClient();

  // Get current user first
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  // Query conversations with participants (no user join - requires migration)
  let query = supabase
    .from('conversations')
    .select(`
      *,
      patient:patients(*),
      participants:conversation_participants!inner(
        id,
        conversation_id,
        user_id,
        role,
        joined_at,
        left_at,
        last_read_at,
        is_muted
      )
    `)
    .is('conversation_participants.left_at', null)
    .order('last_message_at', { ascending: false });

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  const { data: conversations, error } = await query;

  if (error) throw error;
  if (!conversations) return [];

  // Get all unique user IDs from participants
  const userIds = new Set<string>();
  conversations.forEach((conv) => {
    (conv.participants || []).forEach((p: { user_id: string }) => {
      if (p.user_id) userIds.add(p.user_id);
    });
  });

  // Fetch user details separately
  const userMap = new Map<string, User>();
  if (userIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', Array.from(userIds));

    if (users) {
      users.forEach((u) => userMap.set(u.id, u as User));
    }
  }

  // Get unread counts for each conversation
  const unreadCounts = new Map<string, number>();
  if (currentUserId) {
    for (const conv of conversations) {
      const participant = (conv.participants || []).find(
        (p: { user_id: string }) => p.user_id === currentUserId
      );
      if (participant) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .gt('created_at', participant.last_read_at || '1970-01-01')
          .neq('sender_id', currentUserId);
        unreadCounts.set(conv.id, count || 0);
      }
    }
  }

  // Build conversation details with enriched participants
  return conversations.map((conv) => ({
    ...conv,
    participants: (conv.participants || []).map((p: { user_id: string; [key: string]: unknown }) => ({
      ...p,
      user: userMap.get(p.user_id) || null,
    })) as ConversationParticipant[],
    unread_count: unreadCounts.get(conv.id) || 0,
  })) as ConversationWithDetails[];
}

/**
 * Get a single conversation by ID with full details
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationWithDetails | null> {
  const supabase = await createClient();

  // Query conversation with participants (no user join - requires migration)
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select(`
      *,
      patient:patients(*),
      participants:conversation_participants(
        id,
        conversation_id,
        user_id,
        role,
        joined_at,
        left_at,
        last_read_at,
        is_muted
      )
    `)
    .eq('id', conversationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Filter out participants who have left
  const activeParticipants = (conversation.participants || []).filter(
    (p: { left_at: string | null }) => p.left_at === null
  );

  // Get user IDs from active participants
  const userIds = activeParticipants
    .map((p: { user_id: string }) => p.user_id)
    .filter(Boolean);

  // Fetch user details separately
  const userMap = new Map<string, User>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', userIds);

    if (users) {
      users.forEach((u) => userMap.set(u.id, u as User));
    }
  }

  // Enrich participants with user data
  const enrichedParticipants = activeParticipants.map((p: { user_id: string; [key: string]: unknown }) => ({
    ...p,
    user: userMap.get(p.user_id) || null,
  }));

  return {
    ...conversation,
    participants: enrichedParticipants as ConversationParticipant[],
  } as ConversationWithDetails;
}

/**
 * Get messages for a conversation with cursor-based pagination
 */
export async function getMessages(
  conversationId: string,
  options?: {
    cursor?: string;
    limit?: number;
  }
): Promise<{ messages: MessageWithSender[]; hasMore: boolean; cursor: string | null }> {
  const supabase = await createClient();
  const limit = options?.limit || 50;

  // Query messages without sender join (requires migration)
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  const { data: messages, error } = await query;

  if (error) throw error;
  if (!messages) return { messages: [], hasMore: false, cursor: null };

  // Check if there are more messages
  const hasMore = messages.length > limit;
  const messagesSlice = hasMore ? messages.slice(0, limit) : messages;

  // Get unique sender IDs
  const senderIds = Array.from(new Set(messagesSlice.map((m) => m.sender_id).filter(Boolean)));

  // Fetch sender details separately
  const senderMap = new Map<string, User>();
  if (senderIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', senderIds);

    if (users) {
      users.forEach((u) => senderMap.set(u.id, u as User));
    }
  }

  // Enrich messages with sender data and reverse to get chronological order
  const messagesWithSenders = messagesSlice.map((m) => ({
    ...m,
    sender: m.sender_id ? senderMap.get(m.sender_id) || null : null,
  })).reverse() as MessageWithSender[];

  const cursor = hasMore
    ? messagesSlice[messagesSlice.length - 1]?.created_at
    : null;

  return { messages: messagesWithSenders, hasMore, cursor };
}

/**
 * Send a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  options?: {
    messageType?: 'text' | 'system' | 'attachment';
    metadata?: Record<string, unknown>;
  }
): Promise<Message> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: options?.messageType || 'text',
      metadata: options?.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Create a new direct message conversation (or find existing)
 */
export async function createDirectMessage(
  otherUserId: string
): Promise<Conversation> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('find_or_create_direct_message', {
    other_user_id: otherUserId,
  });

  if (error) throw error;

  // Fetch the full conversation
  const conversation = await getConversation(data);
  if (!conversation) throw new Error('Failed to create conversation');

  return conversation;
}

/**
 * Create a new group chat
 */
export async function createGroupChat(
  name: string,
  participantIds: string[]
): Promise<Conversation> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create the conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      type: 'group',
      name,
      created_by: user.id,
    })
    .select()
    .single();

  if (convError) throw convError;

  // Add all participants including the creator
  const allParticipants = Array.from(new Set([user.id, ...participantIds]));
  const participantInserts = allParticipants.map((userId) => ({
    conversation_id: conversation.id,
    user_id: userId,
    role: userId === user.id ? 'admin' : 'member',
  }));

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert(participantInserts);

  if (partError) throw partError;

  // Add system message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_id: null,
    content: `${name} group created`,
    message_type: 'system',
  });

  // Return full conversation
  const fullConversation = await getConversation(conversation.id);
  if (!fullConversation) throw new Error('Failed to fetch conversation');

  return fullConversation;
}

/**
 * Mark a conversation as read
 */
export async function markConversationRead(
  conversationId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Add participants to a group conversation
 */
export async function addParticipants(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  const supabase = await createClient();

  const inserts = userIds.map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    role: 'member',
  }));

  const { error } = await supabase
    .from('conversation_participants')
    .insert(inserts);

  if (error) throw error;
}

/**
 * Leave a conversation (for group chats)
 */
export async function leaveConversation(
  conversationId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('conversation_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Archive a conversation
 */
export async function archiveConversation(
  conversationId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('conversations')
    .update({ is_archived: true })
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Get facility users for starting new conversations
 */
export async function getFacilityUsers(): Promise<User[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as User[];
}

/**
 * Get conversation for a patient (if exists)
 */
export async function getPatientConversation(
  patientId: string
): Promise<ConversationWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('patient_id', patientId)
    .eq('type', 'patient')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return getConversation(data.id);
}
