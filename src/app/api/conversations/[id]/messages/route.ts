import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getMessages, sendMessage, getConversation } from '@/lib/messages';
import { sendPushNotificationToMultipleUsers } from '@/lib/push-notifications';

export const dynamic = 'force-dynamic';

// Create admin client for notification operations (bypasses RLS)
const getAdminClient = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;

    const result = await getMessages(conversationId, { cursor, limit });

    return NextResponse.json({
      messages: result.messages,
      has_more: result.hasMore,
      cursor: result.cursor,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json();
    const { content, message_type, metadata } = body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    const message = await sendMessage(conversationId, content.trim(), {
      messageType: message_type,
      metadata,
    });

    // Get conversation details for notifications
    const conversation = await getConversation(conversationId);

    if (conversation && conversation.participants) {
      // Get sender name
      const { data: senderData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user.id)
        .single();

      const senderName = senderData?.name || senderData?.email?.split('@')[0] || 'Someone';

      // Get conversation display name
      let conversationName = conversation.name || 'a conversation';
      if (conversation.type === 'patient' && conversation.patient) {
        conversationName = `${conversation.patient.first_name} ${conversation.patient.last_name}'s care team`;
      } else if (conversation.type === 'direct') {
        conversationName = 'a direct message';
      }

      // Get recipient user IDs (exclude sender)
      const recipientIds = conversation.participants
        .filter((p) => p.user_id !== user.id && !p.left_at)
        .map((p) => p.user_id);

      if (recipientIds.length > 0) {
        const adminClient = getAdminClient();

        // Create in-app notifications for all recipients
        const notifications = recipientIds.map((recipientId) => ({
          user_id: recipientId,
          type: 'message',
          title: `New message from ${senderName}`,
          message: content.trim().substring(0, 100),
          related_patient_id: conversation.type === 'patient' ? conversation.patient_id : null,
          metadata: {
            conversation_id: conversationId,
            conversation_type: conversation.type,
            sender_id: user.id,
            sender_name: senderName,
            push_queued: true,
          },
        }));

        console.log('[Messages API] Creating notifications for', recipientIds.length, 'recipients');

        // Insert notifications (fire and forget - don't block response)
        adminClient
          .from('notifications')
          .insert(notifications)
          .then(({ error, data }) => {
            if (error) {
              console.error('[Messages API] Failed to create notifications:', error);
            } else {
              console.log('[Messages API] Successfully created notifications');
            }
          });

        // Send push notifications (fire and forget)
        sendPushNotificationToMultipleUsers(recipientIds, {
          title: `Message from ${senderName}`,
          body: content.trim().substring(0, 100),
          url: `/dashboard/messages?conversation=${conversationId}`,
          tag: `message-${conversationId}`,
        }).catch((error) => {
          console.error('Failed to send push notifications:', error);
        });
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error: unknown) {
    console.error('Send message error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
