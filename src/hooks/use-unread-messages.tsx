'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { Conversation } from '@/types/messages';

interface UnreadMessagesState {
  totalUnread: number;
  latestConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * OPTIMIZED: Hook for tracking unread message counts
 * - Uses dedicated lightweight API endpoint instead of fetching all conversations
 * - Debounces real-time updates to prevent excessive API calls
 * - Optimistically updates count on new messages
 */
export function useUnreadMessages(): UnreadMessagesState {
  const [totalUnread, setTotalUnread] = useState(0);
  const [latestConversation, setLatestConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Fetch just the unread count (lightweight)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/unread-count');
      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      setTotalUnread(data.count || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced fetch to prevent rapid consecutive API calls
  const debouncedFetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 500); // 500ms debounce
  }, [fetchUnreadCount]);

  // Initial fetch and get current user
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      currentUserIdRef.current = user?.id || null;
      await fetchUnreadCount();
    };
    init();
  }, [fetchUnreadCount]);

  // Subscribe to realtime message updates with optimistic updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('unread-messages-optimized')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Optimistic update: increment count if message is from another user
          const newMessage = payload.new as { sender_id: string | null; message_type: string };
          if (
            newMessage.sender_id !== currentUserIdRef.current &&
            newMessage.message_type !== 'system'
          ) {
            setTotalUnread((prev) => prev + 1);
          }
          // Debounced fetch to sync with server (handles edge cases)
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
        },
        (payload) => {
          // Only refresh if it's our own last_read_at update
          const updated = payload.new as { user_id: string; last_read_at: string };
          if (updated.user_id === currentUserIdRef.current) {
            // Debounce the fetch since multiple updates might come quickly
            debouncedFetch();
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [debouncedFetch]);

  return {
    totalUnread,
    latestConversation, // Note: This is now always null for performance. Use conversations list if needed.
    isLoading,
    error,
    refresh: fetchUnreadCount,
  };
}
