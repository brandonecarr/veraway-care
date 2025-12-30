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

  let query = supabase
    .from('conversations')
    .select(`
      *,
      patient:patients(*)
    `)
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

  // Get all participants for these conversations
  const conversationIds = conversations.map((c) => c.id);

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('*')
    .in('conversation_id', conversationIds)
    .is('left_at', null);

  // Get user details for participants
  const userIds = new Set(participants?.map((p) => p.user_id) || []);
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .in('id', Array.from(userIds));

  const userMap = new Map(users?.map((u) => [u.id, u]) || []);

  // Get unread counts for each conversation
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  // Build conversation details
  return conversations.map((conv) => {
    const convParticipants = (participants || [])
      .filter((p) => p.conversation_id === conv.id)
      .map((p) => ({
        ...p,
        user: userMap.get(p.user_id) as User | undefined,
      }));

    // Calculate unread count from participant's last_read_at
    const currentParticipant = convParticipants.find(
      (p) => p.user_id === currentUserId
    );
    const lastReadAt = currentParticipant?.last_read_at;

    return {
      ...conv,
      participants: convParticipants as ConversationParticipant[],
      // We'll calculate unread_count separately if needed
    } as ConversationWithDetails;
  });
}

/**
 * Get a single conversation by ID with full details
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationWithDetails | null> {
  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select(`
      *,
      patient:patients(*)
    `)
    .eq('id', conversationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Get participants
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('left_at', null);

  // Get user details
  const userIds = participants?.map((p) => p.user_id) || [];
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .in('id', userIds);

  const userMap = new Map(users?.map((u) => [u.id, u]) || []);

  return {
    ...conversation,
    participants: (participants || []).map((p) => ({
      ...p,
      user: userMap.get(p.user_id) as User | undefined,
    })) as ConversationParticipant[],
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

  // Get sender details
  const senderIds = new Set(
    messagesSlice.map((m) => m.sender_id).filter(Boolean)
  );
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .in('id', Array.from(senderIds));

  const userMap = new Map(users?.map((u) => [u.id, u]) || []);

  const messagesWithSenders = messagesSlice.map((m) => ({
    ...m,
    sender: m.sender_id ? (userMap.get(m.sender_id) as User | null) : null,
  })) as MessageWithSender[];

  // Reverse to get chronological order
  messagesWithSenders.reverse();

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
