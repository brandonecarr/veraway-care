'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import { toast } from 'sonner';
import type { ConversationWithDetails } from '@/types/messages';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeConversationsOptions {
  selectedConversationId?: string | null;
}

interface UseRealtimeConversationsReturn {
  conversations: ConversationWithDetails[];
  isConnected: boolean;
  isLoading: boolean;
  refreshConversations: () => Promise<void>;
}

export function useRealtimeConversations(
  options?: UseRealtimeConversationsOptions
): UseRealtimeConversationsReturn {
  const selectedConversationId = options?.selectedConversationId;
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
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            async (payload) => {
              if (!isMounted) return;

              const newMessage = payload.new as {
                id: string;
                conversation_id: string;
                sender_id: string | null;
                content: string;
                message_type: string;
              };

              // Refetch to update last_message_preview and ordering
              fetchConversations();

              // Show toast if message is from another user and not in the selected conversation
              if (
                newMessage.sender_id &&
                newMessage.sender_id !== user.id &&
                newMessage.conversation_id !== selectedConversationId &&
                newMessage.message_type !== 'system'
              ) {
                // Get sender name
                const { data: senderData } = await supabase
                  .from('users')
                  .select('name, email')
                  .eq('id', newMessage.sender_id)
                  .single();

                const senderName = senderData?.name || senderData?.email?.split('@')[0] || 'Someone';
                const messagePreview = newMessage.content.substring(0, 50) + (newMessage.content.length > 50 ? '...' : '');

                toast.message(`New message from ${senderName}`, {
                  description: messagePreview,
                  action: {
                    label: 'View',
                    onClick: () => {
                      // Navigate or select the conversation
                      window.location.href = `/dashboard/messages?conversation=${newMessage.conversation_id}`;
                    },
                  },
                });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
            },
            () => {
              if (!isMounted) return;
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
  }, [fetchConversations, selectedConversationId]);

  return {
    conversations,
    isConnected,
    isLoading,
    refreshConversations: fetchConversations,
  };
}
