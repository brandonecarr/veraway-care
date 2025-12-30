'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { MessageWithSender, User } from '@/types/messages';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeChatMessagesReturn {
  messages: MessageWithSender[];
  isConnected: boolean;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
  typingUsers: User[];
  setTyping: (isTyping: boolean) => void;
}

export function useRealtimeChatMessages(
  conversationId: string | null
): UseRealtimeChatMessagesReturn {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserRef = useRef<User | null>(null);

  const fetchMessages = useCallback(
    async (loadMore = false) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const url = new URL(
          `/api/conversations/${conversationId}/messages`,
          window.location.origin
        );
        if (loadMore && cursor) {
          url.searchParams.set('cursor', cursor);
        }

        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];

          if (loadMore) {
            setMessages((prev) => [...newMessages, ...prev]);
          } else {
            setMessages(newMessages);
          }

          setHasMore(data.has_more || false);
          setCursor(data.cursor || null);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, cursor]
  );

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await fetchMessages(true);
    }
  }, [hasMore, isLoading, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !content.trim()) return;

      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const tempMessage: MessageWithSender = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: currentUserRef.current?.id || null,
        sender: currentUserRef.current,
        content: content.trim(),
        message_type: 'text',
        metadata: {},
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempMessage]);

      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.trim() }),
          }
        );

        if (!response.ok) {
          // Remove temp message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          throw new Error('Failed to send message');
        }
      } catch (error) {
        console.error('Send message error:', error);
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [conversationId]
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !currentUserRef.current) return;

      channelRef.current.track({
        user: currentUserRef.current,
        isTyping,
      });
    },
    []
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      // Fetch current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('id', user.id)
          .single();

        if (userData) {
          currentUserRef.current = userData as User;
        }
      }

      // Initial fetch
      setCursor(null);
      await fetchMessages(false);

      try {
        // Set up real-time subscription
        const channel = supabase
          .channel(`chat-${conversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Fetch sender info for the new message
              const newMessage = payload.new as MessageWithSender;

              // Check if this is a temp message replacement
              setMessages((prev) => {
                // Remove any temp messages and duplicates
                const filtered = prev.filter(
                  (msg) =>
                    !msg.id.startsWith('temp-') && msg.id !== newMessage.id
                );

                // Fetch sender info
                if (newMessage.sender_id) {
                  supabase
                    .from('users')
                    .select('id, email, name, avatar_url')
                    .eq('id', newMessage.sender_id)
                    .single()
                    .then(({ data }) => {
                      if (data && isMounted) {
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === newMessage.id
                              ? { ...m, sender: data as User }
                              : m
                          )
                        );
                      }
                    });
                }

                return [...filtered, newMessage];
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              if (!isMounted) return;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === payload.new.id
                    ? { ...msg, ...payload.new }
                    : msg
                )
              );
            }
          )
          .on('presence', { event: 'sync' }, () => {
            if (!isMounted) return;
            const state = channel.presenceState();
            const typing: User[] = [];

            Object.values(state).forEach((presences: unknown[]) => {
              presences.forEach((presence: unknown) => {
                const p = presence as { user?: User; isTyping?: boolean };
                if (
                  p.isTyping &&
                  p.user &&
                  p.user.id !== currentUserRef.current?.id
                ) {
                  typing.push(p.user);
                }
              });
            });

            setTypingUsers(typing);
          })
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
  }, [conversationId]); // Remove fetchMessages from deps to avoid re-subscribing

  const refreshMessages = useCallback(async () => {
    setCursor(null);
    await fetchMessages(false);
  }, [fetchMessages]);

  return {
    messages,
    isConnected,
    isLoading,
    hasMore,
    loadMore,
    sendMessage,
    refreshMessages,
    typingUsers,
    setTyping,
  };
}
