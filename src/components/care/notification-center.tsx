'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { formatDistanceToNow } from 'date-fns';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '../../../supabase/client';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import { ConnectionStatus } from './connection-status';

// Map raw database field names to human-readable labels
const FIELD_LABELS: Record<string, string> = {
  mrn: 'MRN',
  first_name: 'first name',
  last_name: 'last name',
  date_of_birth: 'date of birth',
  admission_date: 'admission date',
  admitted_date: 'admission date',
  diagnosis: 'diagnosis',
  status: 'status',
  benefit_period: 'benefit period',
  level_of_care: 'level of care',
  rn_case_manager_id: 'case manager',
  residence_type: 'residence type',
  discharge_date: 'discharge date',
  death_date: 'death date',
  cause_of_death: 'cause of death',
  bereavement_status: 'bereavement status',
};

// Prettify notification messages that contain raw database field names
function prettifyMessage(message: string): string {
  if (!message) return message;

  // Check if message contains a colon followed by field names (pattern: "updated Patient: field1, field2, ...")
  const colonIndex = message.lastIndexOf(':');
  if (colonIndex === -1) return message;

  const beforeColon = message.substring(0, colonIndex);
  const afterColon = message.substring(colonIndex + 1).trim();

  // Check if the part after colon looks like raw field names (contains underscores or known raw fields)
  const hasRawFieldNames = afterColon.includes('_') ||
    Object.keys(FIELD_LABELS).some(field => afterColon.toLowerCase().includes(field));

  if (!hasRawFieldNames) return message;

  // Split by comma and transform each field
  const fields = afterColon.split(',').map(f => f.trim()).filter(Boolean);

  // Filter out duplicates (admitted_date/admission_date are the same)
  const uniqueFields = fields.filter(f =>
    f !== 'admitted_date' || !fields.includes('admission_date')
  );

  const formatted = uniqueFields.map(f => FIELD_LABELS[f] || f.replace(/_/g, ' '));

  if (formatted.length === 0) return beforeColon;
  if (formatted.length === 1) return `${beforeColon}: ${formatted[0]}`;
  if (formatted.length === 2) return `${beforeColon}: ${formatted[0]} and ${formatted[1]}`;

  return `${beforeColon}: ${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

export function NotificationCenter() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // Use real-time notifications hook
  const { 
    notifications, 
    unreadCount, 
    isConnected,
    markAsRead, 
    markAllAsRead 
  } = useRealtimeNotifications(userId);

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    setIsOpen(false);

    const basePath = slug ? `/${slug}/dashboard` : '/dashboard';

    // Handle message notifications - navigate to the conversation
    if (notification.type === 'message' && notification.metadata?.conversation_id) {
      router.push(`${basePath}/messages?conversation=${notification.metadata.conversation_id}`);
      return;
    }

    // Handle handoff/after-shift report notifications - navigate to after-shift reports page
    if (notification.type === 'handoff' || notification.related_handoff_id) {
      router.push(`${basePath}/after-shift-reports`);
      return;
    }

    // Handle patient notifications - navigate to patients page with patient detail
    if (notification.type === 'new_patient' || notification.type === 'patient_update') {
      const patientId = notification.related_patient_id || notification.metadata?.patient_id;
      if (patientId) {
        router.push(`${basePath}/patients?patient=${patientId}`);
        return;
      }
      // Fallback to patients page if no patient ID
      router.push(`${basePath}/patients`);
      return;
    }

    // Handle issue-related notifications - navigate and open issue detail panel
    if (notification.related_issue_id) {
      router.push(`${basePath}?issue=${notification.related_issue_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment':
      case 'issue_assigned':
        return '👤';
      case 'message':
        return '💬';
      case 'status_change':
        return '🔄';
      case 'handoff':
        return '🔔';
      case 'overdue':
        return '⚠️';
      case 'new_patient':
        return '🏥';
      case 'patient_update':
        return '📝';
      case 'new_issue':
        return '🚨';
      case 'issue_update':
        return '💬';
      case 'issue_resolved':
        return '✅';
      default:
        return '📋';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Notifications</span>
              <ConnectionStatus isConnected={isConnected} showLabel={false} />
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 text-xs"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsOpen(false);
                  const basePath = slug ? `/${slug}/dashboard` : '/dashboard';
                  router.push(`${basePath}/settings#notifications`);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'All caught up!'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-brand-border mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all duration-200
                    hover:shadow-card-hover hover:border-brand-teal touch-manipulation
                    ${
                      !notification.is_read
                        ? 'bg-brand-teal/5 border-l-4 border-l-brand-teal'
                        : 'bg-white hover:bg-muted/30'
                    }
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-body text-brand-charcoal">
                          {notification.title || notification.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Notification'}
                        </h4>
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 press-scale"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-body text-muted-foreground mt-1 line-clamp-2">
                        {prettifyMessage(notification.message)}
                        {(notification.type === 'assignment' || notification.type === 'issue_assigned') && (
                          <span className="text-amber-600 font-medium"> Acknowledge now.</span>
                        )}
                      </p>
                      {notification.type === 'message' && notification.metadata?.sender_name && (
                        <p className="text-metadata text-muted-foreground mt-2">
                          From: {notification.metadata.sender_name}
                        </p>
                      )}
                      {notification.issue?.patient && (
                        <p className="text-metadata text-muted-foreground mt-2">
                          Patient: {notification.issue.patient.first_name}{' '}
                          {notification.issue.patient.last_name} (
                          {notification.issue.patient.mrn})
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
