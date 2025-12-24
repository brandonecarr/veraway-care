import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';

export const dynamic = 'force-dynamic';

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

    const body = await request.json();
    const { note } = body;

    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    // Create audit log entry
    const { error } = await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: params.id,
        user_id: user.id,
        action: 'updated',
        details: {
          note
        }
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add update error:', error);
    return NextResponse.json({ error: 'Failed to add update' }, { status: 500 });
  }
}
