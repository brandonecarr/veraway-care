import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { getIssueMessages, addIssueMessage } from '@/lib/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await getIssueMessages(params.id);
    
    // Get unique user IDs from messages
    const userIds = Array.from(new Set(messages.map((m: any) => m.user_id).filter(Boolean)));
    
    // Fetch user data from public.users table
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, full_name, avatar_url')
        .in('id', userIds);
      
      if (users) {
        users.forEach(u => {
          usersMap[u.id] = u;
        });
      }
    }
    
    // Attach user data to messages
    const messagesWithUsers = messages.map((msg: any) => ({
      ...msg,
      user: usersMap[msg.user_id] || { id: msg.user_id, email: 'Unknown User' }
    }));
    
    return NextResponse.json(messagesWithUsers);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();
    const newMessage = await addIssueMessage(params.id, user.id, message);

    // Create audit log entry for message
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: params.id,
        user_id: user.id,
        action: 'message_sent',
        details: {
          message: message.substring(0, 100)
        }
      });

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error('Add message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
