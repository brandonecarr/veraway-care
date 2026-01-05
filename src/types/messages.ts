import type { Patient } from './care-coordination';

export type ConversationType = 'patient' | 'direct' | 'group';
export type MessageType = 'text' | 'system' | 'attachment';
export type ParticipantRole = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface Conversation {
  id: string;
  hospice_id: string;
  type: ConversationType;
  name: string | null;
  patient_id: string | null;
  patient?: Patient;
  created_by: string;
  last_message_at: string;
  last_message_preview: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  participants?: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user?: User;
  role: ParticipantRole;
  joined_at: string;
  left_at: string | null;
  last_read_at: string;
  is_muted: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender?: User;
  content: string;
  message_type: MessageType;
  metadata: Record<string, unknown>;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[];
  patient?: Patient;
}

export interface MessageWithSender extends Omit<Message, 'sender'> {
  sender: User | null;
}

// API request/response types
export interface CreateConversationRequest {
  type: 'direct' | 'group';
  name?: string;
  participant_ids: string[];
}

export interface SendMessageRequest {
  content: string;
  message_type?: MessageType;
  metadata?: Record<string, unknown>;
}

export interface MessagesResponse {
  messages: MessageWithSender[];
  has_more: boolean;
  cursor: string | null;
}

export interface ConversationsResponse {
  conversations: ConversationWithDetails[];
}
