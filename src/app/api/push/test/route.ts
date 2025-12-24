import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client for database operations to bypass RLS
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No push subscriptions found' },
        { status: 404 }
      );
    }

    // Send test notification to all user's subscriptions
    const webpush = require('web-push');

    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@carecoordination.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body: 'Push notifications are working! You will receive alerts for critical issues.',
      tag: 'test-notification',
      priority: 'normal',
      url: '/dashboard',
    });

    // Send to all subscriptions and track results
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription_data, payload);
          console.log('Successfully sent notification to:', sub.endpoint.substring(0, 50) + '...');
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error('Error sending to subscription:', error.message || error);
          console.error('Subscription endpoint:', sub.endpoint);
          console.error('Error status code:', error.statusCode);
          
          // If subscription is no longer valid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
            console.log('Removed invalid subscription:', sub.id);
          }
          
          return { 
            success: false, 
            endpoint: sub.endpoint, 
            error: error.message || 'Unknown error',
            statusCode: error.statusCode 
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedResults = results.filter(r => !r.success);

    console.log(`Push notification results: ${successCount}/${subscriptions.length} successful`);
    
    if (failedResults.length > 0) {
      console.log('Failed notifications:', JSON.stringify(failedResults, null, 2));
    }

    return NextResponse.json({ 
      success: successCount > 0,
      totalSubscriptions: subscriptions.length,
      successCount,
      failedCount: failedResults.length,
      failures: failedResults.map(f => ({ 
        error: f.error, 
        statusCode: f.statusCode,
        endpoint: f.endpoint?.substring(0, 50) + '...'
      }))
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
