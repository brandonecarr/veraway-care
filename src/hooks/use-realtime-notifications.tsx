'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../../supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface Notification {
  id: string;
  user_id: string;
  issue_id: string;
  type: string;
  title?: string;
  message: string;
  is_read: boolean;
  created_at: string;
  issue?: any;
  related_issue_id?: string;
  related_patient_id?: string;
  metadata?: any;
}

interface UseRealtimeNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useRealtimeNotifications(userId: string | null): UseRealtimeNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(true); // Default to true
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(Array.isArray(data) ? data : []);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      // Silently fail - network errors are expected in some environments
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH'
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    let notificationsChannel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupRealtimeSubscription = async () => {
      // Initial fetch
      await fetchNotifications();

      try {
        // Set up real-time subscription for notifications for this user
        notificationsChannel = supabase
          .channel(`notifications-${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`
            },
            (payload: any) => {
              if (!isMounted) return;

              console.log('[Realtime Notifications] Event received:', payload.eventType, payload);

              if (payload.eventType === 'INSERT') {
                const newNotif = payload.new as Notification;

                // Show toast notification for new notification
                toast.info(newNotif.title || 'New Notification', {
                  description: newNotif.message,
                  duration: 5000,
                });

                setNotifications((prev) => {
                  if (prev.some(notif => notif.id === newNotif.id)) {
                    return prev;
                  }

                  if (newNotif.metadata?.push_queued && !newNotif.metadata?.push_sent) {
                    fetch('/api/push/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notificationId: newNotif.id }),
                    }).catch(() => {});
                  }

                  return [newNotif, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                setNotifications((prev) =>
                  prev.map((notif) =>
                    notif.id === payload.new.id ? { ...notif, ...payload.new } as Notification : notif
                  )
                );
              } else if (payload.eventType === 'DELETE') {
                setNotifications((prev) => prev.filter((notif) => notif.id !== payload.old.id));
              }
            }
          )
          .subscribe((status: string) => {
            if (!isMounted) return;

            console.log('[Realtime Notifications] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              console.log('[Realtime Notifications] Successfully subscribed to channel');
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

        channelRef.current = notificationsChannel;
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
      }
    };
  }, [userId, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    refreshNotifications: fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}
