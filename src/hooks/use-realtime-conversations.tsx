'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { ConversationWithDetails } from '@/types/messages';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeConversationsReturn {
  conversations: ConversationWithDetails[];
  isConnected: boolean;
  isLoading: boolean;
  refreshConversations: () => Promise<void>;
}

export function useRealtimeConversations(): UseRealtimeConversationsReturn {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      await fetchConversations();

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // Subscribe to conversation changes
        const channel = supabase
          .channel('conversations-list')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
            },
            () => {
              if (!isMounted) return;
              // Refetch on any conversation change
              fetchConversations();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'conversation_participants',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              if (!isMounted) return;
              // User was added to a new conversation
              fetchConversations();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
            },
            () => {
              if (!isMounted) return;
              // Refetch to update last_message_preview and ordering
              fetchConversations();
            }
          )
          .subscribe((status: string) => {
            if (!isMounted) return;

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setIsConnected(false);
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
              retryTimeoutRef.current = setTimeout(() => {
                if (isMounted && channelRef.current) {
                  supabase.removeChannel(channelRef.current);
                  setupRealtimeSubscription();
                }
              }, 5000);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Real-time subscription error:', error);
      }
    };

    setupRealtimeSubscription();

    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [fetchConversations]);

  return {
    conversations,
    isConnected,
    isLoading,
    refreshConversations: fetchConversations,
  };
}
