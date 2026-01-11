import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages/unread-count
 * Returns the total unread message count for the current user
 * Optimized endpoint that uses a single database query
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to use the optimized database function first
    const { data: totalCount, error: rpcError } = await supabase.rpc(
      'get_total_unread_count'
    );

    if (!rpcError && totalCount !== null) {
      return NextResponse.json({ count: totalCount });
    }

    // Fallback: compute count manually if RPC not available
    console.warn('Falling back to non-optimized unread count query');

    // Get all conversations where user is a participant
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)
      .is('left_at', null);

    if (!participants || participants.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // Count unread messages across all conversations in a single query
    let totalUnread = 0;

    for (const participant of participants) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', participant.conversation_id)
        .gt('created_at', participant.last_read_at || '1970-01-01')
        .neq('sender_id', user.id)
        .eq('is_deleted', false);

      totalUnread += count || 0;
    }

    return NextResponse.json({ count: totalUnread });
  } catch (error) {
    console.error('Get unread count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
