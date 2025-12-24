import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const webpush = require('web-push');

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@carecoordination.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Create admin client for database operations
const getAdminClient = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  issueId?: string;
  notificationId?: string;
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('Push notifications not configured - VAPID keys missing');
      return { success: false, error: 'Push notifications not configured' };
    }

    const supabaseAdmin = getAdminClient();

    // Check if user has push notifications enabled
    const { data: preferences } = await supabaseAdmin
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .single();

    if (!preferences?.push_enabled) {
      return { success: false, error: 'User has push notifications disabled' };
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'No push subscriptions found' };
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard',
      tag: payload.tag || 'care-coordination',
      priority: payload.priority || 'normal',
      issueId: payload.issueId,
      notificationId: payload.notificationId,
    });

    // Send to all user's subscriptions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription_data, notificationPayload);
      } catch (error: any) {
        console.error('Error sending push notification:', error);
        
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log('Removed invalid push subscription');
        }
        
        throw error;
      }
    });

    await Promise.allSettled(sendPromises);

    return { success: true };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendPushNotificationToMultipleUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ successCount: number; failCount: number }> {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, payload))
  );

  const successCount = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;
  
  const failCount = results.length - successCount;

  return { successCount, failCount };
}
