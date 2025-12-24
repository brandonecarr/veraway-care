import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/push-notifications';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID required' },
        { status: 400 }
      );
    }

    // Use service role client for database operations to bypass RLS
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the notification
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .select('*, issue:issues(issue_number), patient:patients(first_name, last_name)')
      .eq('id', notificationId)
      .single();

    if (error) throw error;

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Determine priority
    const priority = notification.metadata?.push_priority || 'normal';
    
    // Construct URL
    let url = '/dashboard';
    if (notification.related_issue_id) {
      url = `/dashboard?issue=${notification.related_issue_id}`;
    }

    // Send push notification
    const result = await sendPushNotification(notification.user_id, {
      title: notification.title,
      body: notification.message,
      url,
      tag: notification.type,
      priority,
      issueId: notification.related_issue_id,
      notificationId: notification.id,
    });

    // Update notification metadata to mark as sent
    if (result.success) {
      await supabaseAdmin
        .from('notifications')
        .update({
          metadata: {
            ...notification.metadata,
            push_sent: true,
            push_sent_at: new Date().toISOString(),
          },
        })
        .eq('id', notificationId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
