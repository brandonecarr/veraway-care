'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../supabase/client';
import type { Conversation } from '@/types/messages';

interface UnreadMessagesState {
  totalUnread: number;
  latestConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUnreadMessages(): UnreadMessagesState {
  const [totalUnread, setTotalUnread] = useState(0);
  const [latestConversation, setLatestConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnreadMessages = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      const conversations: Conversation[] = data.conversations || [];

      // Calculate total unread count
      const total = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setTotalUnread(total);

      // Find the conversation with the most recent unread message
      const conversationsWithUnread = conversations.filter((c) => (c.unread_count || 0) > 0);
      if (conversationsWithUnread.length > 0) {
        // Sort by last_message_at descending
        conversationsWithUnread.sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
        setLatestConversation(conversationsWithUnread[0]);
      } else {
        setLatestConversation(null);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching unread messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUnreadMessages();
  }, [fetchUnreadMessages]);

  // Subscribe to realtime message updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('dashboard-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refresh unread count when a new message is inserted
          fetchUnreadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          // Refresh when read status changes
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadMessages]);

  return {
    totalUnread,
    latestConversation,
    isLoading,
    error,
    refresh: fetchUnreadMessages,
  };
}
