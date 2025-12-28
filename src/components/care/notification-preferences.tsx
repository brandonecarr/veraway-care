'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationPreferences as NotificationPrefsType } from '@/types/care-coordination';
import { toast } from 'sonner';
import { Loader2, Bell, BellOff, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPrefsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading: pushLoading,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      } else {
        // Silently fail - user may not have preferences set yet
        setPreferences(null);
      }
    } catch (error) {
      // Network errors are expected in some environments - fail silently
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        toast.success('Notification preferences updated');
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPrefsType, value: boolean) => {
    if (!preferences) return;
    
    // Handle push notification toggle
    if (key === 'push_enabled') {
      if (value && !isSubscribed) {
        const success = await subscribeToPush();
        if (!success) return; // Don't update preference if subscription failed
      } else if (!value && isSubscribed) {
        await unsubscribeFromPush();
      }
    }
    
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
        </div>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className="p-6 shadow-card">
        <p className="text-muted-foreground">Failed to load preferences</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-card">
      <div className="space-y-6">
        <div>
          <h3 className="text-section-title font-display text-brand-charcoal mb-1">
            Notification Channels
          </h3>
          <p className="text-body text-muted-foreground mb-4">
            Choose how you want to receive notifications
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="in-app">In-App Notifications</Label>
                <p className="text-metadata text-muted-foreground">
                  Show notifications in the notification center
                </p>
              </div>
              <Switch
                id="in-app"
                checked={preferences.in_app_enabled}
                onCheckedChange={(checked) =>
                  updatePreference('in_app_enabled', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email">Email Notifications</Label>
                <p className="text-metadata text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                id="email"
                checked={preferences.email_enabled}
                onCheckedChange={(checked) =>
                  updatePreference('email_enabled', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="push">Push Notifications</Label>
                  {!isSupported && (
                    <Badge variant="outline" className="text-xs">
                      Not Supported
                    </Badge>
                  )}
                  {isSupported && permission === 'denied' && (
                    <Badge variant="destructive" className="text-xs">
                      Blocked
                    </Badge>
                  )}
                  {isSupported && isSubscribed && (
                    <Badge variant="default" className="text-xs bg-[#81B29A]">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-metadata text-muted-foreground">
                  Receive browser push notifications for critical alerts
                </p>
                {!isSupported && (
                  <p className="text-xs text-[#E07A5F] mt-1">
                    Push notifications are not supported in this browser
                  </p>
                )}
                {isSupported && permission === 'denied' && (
                  <p className="text-xs text-[#E07A5F] mt-1">
                    Push notifications are blocked. Please enable them in your browser settings.
                  </p>
                )}
              </div>
              <Switch
                id="push"
                checked={preferences.push_enabled && isSubscribed}
                onCheckedChange={(checked) =>
                  updatePreference('push_enabled', checked)
                }
                disabled={!isSupported || permission === 'denied' || pushLoading}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-section-title font-display text-brand-charcoal mb-1">
            Notification Types
          </h3>
          <p className="text-body text-muted-foreground mb-4">
            Select which types of notifications you want to receive
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="assignment">Issue Assignments</Label>
                <p className="text-metadata text-muted-foreground">
                  When an issue is assigned to you
                </p>
              </div>
              <Switch
                id="assignment"
                checked={preferences.notify_on_assignment}
                onCheckedChange={(checked) =>
                  updatePreference('notify_on_assignment', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mention">Mentions</Label>
                <p className="text-metadata text-muted-foreground">
                  When someone mentions you in a message
                </p>
              </div>
              <Switch
                id="mention"
                checked={preferences.notify_on_mention}
                onCheckedChange={(checked) =>
                  updatePreference('notify_on_mention', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="issue-update">Issue Updates</Label>
                <p className="text-metadata text-muted-foreground">
                  When issues you created or are assigned to are updated
                </p>
              </div>
              <Switch
                id="issue-update"
                checked={preferences.notify_on_issue_update}
                onCheckedChange={(checked) =>
                  updatePreference('notify_on_issue_update', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="handoff">After Shift Reports</Label>
                <p className="text-metadata text-muted-foreground">
                  When a new shift report is submitted
                </p>
              </div>
              <Switch
                id="handoff"
                checked={preferences.notify_on_handoff}
                onCheckedChange={(checked) =>
                  updatePreference('notify_on_handoff', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="overdue">Overdue Issues</Label>
                <p className="text-metadata text-muted-foreground">
                  When issues become overdue
                </p>
              </div>
              <Switch
                id="overdue"
                checked={preferences.notify_on_overdue}
                onCheckedChange={(checked) =>
                  updatePreference('notify_on_overdue', checked)
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {isSupported && isSubscribed && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch('/api/push/test', {
                    method: 'POST',
                  });
                  if (response.ok) {
                    toast.success('Test notification sent!');
                  } else {
                    toast.error('Failed to send test notification');
                  }
                } catch (error) {
                  toast.error('Failed to send test notification');
                }
              }}
              className="border-brand-teal text-brand-teal hover:bg-brand-teal/10"
            >
              <Bell className="mr-2 h-4 w-4" />
              Test Push Notification
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-teal hover:bg-brand-teal/90 press-scale"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
