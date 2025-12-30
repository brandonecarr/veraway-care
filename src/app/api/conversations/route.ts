import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import {
  getConversations,
  createDirectMessage,
  createGroupChat,
} from '@/lib/messages';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const type = searchParams.get('type') as
      | 'patient'
      | 'direct'
      | 'group'
      | null;

    const conversations = await getConversations({
      includeArchived,
      type: type || undefined,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, name, participant_ids } = body;

    if (!type || !['direct', 'group'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid conversation type. Must be "direct" or "group".' },
        { status: 400 }
      );
    }

    if (!participant_ids || !Array.isArray(participant_ids)) {
      return NextResponse.json(
        { error: 'participant_ids is required and must be an array' },
        { status: 400 }
      );
    }

    let conversation;

    if (type === 'direct') {
      if (participant_ids.length !== 1) {
        return NextResponse.json(
          { error: 'Direct messages require exactly one participant' },
          { status: 400 }
        );
      }
      conversation = await createDirectMessage(participant_ids[0]);
    } else {
      if (!name) {
        return NextResponse.json(
          { error: 'Group chats require a name' },
          { status: 400 }
        );
      }
      conversation = await createGroupChat(name, participant_ids);
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error: unknown) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
