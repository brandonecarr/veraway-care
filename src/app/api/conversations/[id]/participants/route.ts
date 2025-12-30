import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { addParticipants, getConversation } from '@/lib/messages';

export const dynamic = 'force-dynamic';

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
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ participants: conversation.participants });
  } catch (error) {
    console.error('Get participants error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
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
    const { user_ids } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: 'user_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Verify conversation exists and is a group chat
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (conversation.type !== 'group') {
      return NextResponse.json(
        { error: 'Can only add participants to group chats' },
        { status: 400 }
      );
    }

    await addParticipants(conversationId, user_ids);

    // Add system message about new participants
    const { data: newUsers } = await supabase
      .from('users')
      .select('name')
      .in('id', user_ids);

    const names = newUsers?.map((u) => u.name).join(', ') || 'New members';

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: null,
      content: `${names} joined the conversation`,
      message_type: 'system',
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error('Add participants error:', error);
    return NextResponse.json(
      {
        error: 'Failed to add participants',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
