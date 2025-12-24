'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { Issue } from '@/types/care-coordination';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeIssuesReturn {
  issues: Issue[];
  isConnected: boolean;
  isLoading: boolean;
  refreshIssues: () => Promise<void>;
}

export function useRealtimeIssues(): UseRealtimeIssuesReturn {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isConnected, setIsConnected] = useState(true); // Default to true - assume connected until proven otherwise
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      const response = await fetch('/api/issues');
      if (response.ok) {
        const data = await response.json();
        setIssues(Array.isArray(data) ? data : []);
      } else {
        setIssues([]);
      }
    } catch (error) {
      // Silently fail - network errors are expected in some environments
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let issuesChannel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      // Initial fetch
      await fetchIssues();

      try {
        // Set up real-time subscription
        issuesChannel = supabase
          .channel('issues-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'issues'
            },
            (payload: any) => {
              if (!isMounted) return;

              if (payload.eventType === 'INSERT') {
                // Only add non-resolved issues
                if ((payload.new as Issue).status !== 'resolved') {
                  setIssues((prev) => {
                    if (prev.some(issue => issue.id === payload.new.id)) {
                      return prev;
                    }
                    return [payload.new as Issue, ...prev];
                  });
                }
              } else if (payload.eventType === 'UPDATE') {
                const updatedIssue = payload.new as Issue;
                // If issue is now resolved, remove it from the list
                if (updatedIssue.status === 'resolved') {
                  setIssues((prev) => prev.filter((issue) => issue.id !== updatedIssue.id));
                } else {
                  setIssues((prev) =>
                    prev.map((issue) =>
                      issue.id === payload.new.id ? { ...issue, ...payload.new } as Issue : issue
                    )
                  );
                }
              } else if (payload.eventType === 'DELETE') {
                setIssues((prev) => prev.filter((issue) => issue.id !== payload.old.id));
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

        channelRef.current = issuesChannel;
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
  }, [fetchIssues]);

  return {
    issues,
    isConnected,
    isLoading,
    refreshIssues: fetchIssues
  };
}
