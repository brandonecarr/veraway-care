import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await request.json();

    // Use service role client for database operations to bypass RLS
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Save subscription to database
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        subscription_data: subscription,
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }

    // Update user preferences to enable push notifications
    await supabaseAdmin
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        push_enabled: true,
      }, {
        onConflict: 'user_id'
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
