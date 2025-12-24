import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const { status, note } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Get current issue to track old status
    const { data: currentIssue } = await supabase
      .from('issues')
      .select('status')
      .eq('id', params.id)
      .single();

    // Update the issue status
    const { data: issue, error } = await supabase
      .from('issues')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: params.id,
        user_id: user.id,
        action: 'status_changed',
        details: {
          old_status: currentIssue?.status,
          new_status: status,
          note: note || undefined
        }
      });

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
