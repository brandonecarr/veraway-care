'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeContextType {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  connectionStatus: 'disconnected',
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    let issuesChannel: RealtimeChannel;
    let messagesChannel: RealtimeChannel;
    let notificationsChannel: RealtimeChannel;
    let patientsChannel: RealtimeChannel;

    const setupRealtime = async () => {
      try {
        setConnectionStatus('connecting');

        // =====================================================
        // Issues Channel - Listen for all issue changes
        // =====================================================
        issuesChannel = supabase
          .channel('issues-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'issues',
            },
            (payload) => {
              console.log('Issue change:', payload);

              // Invalidate issues queries to refetch
              queryClient.invalidateQueries({ queryKey: ['issues'] });

              // If it's an update, also invalidate the specific issue
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                const issueId = (payload.new as any)?.id;
                if (issueId) {
                  queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
                }
              }

              // Invalidate dashboard metrics
              queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
            }
          )
          .subscribe((status) => {
            console.log('Issues channel status:', status);
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('error');
            }
          });

        // =====================================================
        // Messages Channel - Listen for issue message changes
        // =====================================================
        messagesChannel = supabase
          .channel('messages-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'issue_messages',
            },
            (payload) => {
              console.log('Message change:', payload);

              // Invalidate messages for the specific issue
              if ((payload.new as any)?.issue_id) {
                queryClient.invalidateQueries({
                  queryKey: ['issue-messages', (payload.new as any).issue_id],
                });
              }

              // Also invalidate the issue itself to update message count
              if ((payload.new as any)?.issue_id) {
                queryClient.invalidateQueries({
                  queryKey: ['issue', (payload.new as any).issue_id],
                });
              }
            }
          )
          .subscribe();

        // =====================================================
        // Notifications Channel - User-specific notifications
        // =====================================================
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          notificationsChannel = supabase
            .channel(`user-notifications-${user.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
              },
              (payload) => {
                console.log('Notification change:', payload);

                // Invalidate notifications queries
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                queryClient.invalidateQueries({ queryKey: ['unread-count'] });

                // Show toast for new notifications
                if (payload.eventType === 'INSERT' && payload.new) {
                  // You can add a toast here if needed
                  console.log('New notification:', payload.new);
                }
              }
            )
            .subscribe();
        }

        // =====================================================
        // Patients Channel - Listen for patient changes
        // =====================================================
        patientsChannel = supabase
          .channel('patients-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'patients',
            },
            (payload) => {
              console.log('Patient change:', payload);

              // Invalidate patients queries
              queryClient.invalidateQueries({ queryKey: ['patients'] });

              // If it's a specific patient update
              if ((payload.new as any)?.id) {
                queryClient.invalidateQueries({ queryKey: ['patient', (payload.new as any).id] });
              }
            }
          )
          .subscribe();

        console.log('Realtime subscriptions initialized');
      } catch (error) {
        console.error('Realtime setup error:', error);
        setConnectionStatus('error');
      }
    };

    setupRealtime();

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions');

      if (issuesChannel) {
        supabase.removeChannel(issuesChannel);
      }
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
      }
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
      if (patientsChannel) {
        supabase.removeChannel(patientsChannel);
      }

      setConnectionStatus('disconnected');
    };
  }, [queryClient, supabase]);

  const contextValue: RealtimeContextType = {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}
