'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { IssueMessage } from '@/types/care-coordination';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeMessagesReturn {
  messages: IssueMessage[];
  isConnected: boolean;
  isLoading: boolean;
  refreshMessages: () => Promise<void>;
}

export function useRealtimeMessages(issueId: string | null): UseRealtimeMessagesReturn {
  const [messages, setMessages] = useState<IssueMessage[]>([]);
  const [isConnected, setIsConnected] = useState(true); // Default to true
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!issueId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/issues/${issueId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(Array.isArray(data) ? data : []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      // Silently fail - network errors are expected in some environments
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    if (!issueId) {
      setMessages([]);
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    let messagesChannel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      // Initial fetch
      await fetchMessages();

      try {
        // Set up real-time subscription for messages on this specific issue
        messagesChannel = supabase
          .channel(`messages-${issueId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'issue_messages',
              filter: `issue_id=eq.${issueId}`
            },
            (payload: any) => {
              if (!isMounted) return;

              if (payload.eventType === 'INSERT') {
                setMessages((prev) => {
                  const filtered = prev.filter(msg => 
                    !msg.id.startsWith('temp-') && msg.id !== payload.new.id
                  );
                  return [...filtered, payload.new as IssueMessage];
                });
              } else if (payload.eventType === 'UPDATE') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === payload.new.id ? { ...msg, ...payload.new } as IssueMessage : msg
                  )
                );
              } else if (payload.eventType === 'DELETE') {
                setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
              }
            }
          )
          .subscribe((status: string) => {
            if (!isMounted) return;
            
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Retry connection after a delay
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

        channelRef.current = messagesChannel;
      } catch (error) {
        // Real-time subscription failed, but data fetching still works
      }
    };

    setupRealtimeSubscription();

    // Cleanup
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
  }, [issueId, fetchMessages]);

  return {
    messages,
    isConnected,
    isLoading,
    refreshMessages: fetchMessages
  };
}
