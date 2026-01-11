import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: issueId } = await params;

    // Get current issue to check if user is the assignee and if not already acknowledged
    const { data: currentIssue, error: fetchError } = await supabase
      .from('issues')
      .select('id, issue_number, assigned_to, acknowledged_at, acknowledged_by, patient:patients(first_name, last_name)')
      .eq('id', issueId)
      .single();

    if (fetchError || !currentIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Only the assigned user can acknowledge the issue
    if (currentIssue.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Only the assigned clinician can acknowledge this issue' }, { status: 403 });
    }

    // Check if already acknowledged
    if (currentIssue.acknowledged_at) {
      return NextResponse.json({ error: 'Issue has already been acknowledged' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update the issue with acknowledgement
    const { data: updatedIssue, error: updateError } = await supabase
      .from('issues')
      .update({
        acknowledged_at: now,
        acknowledged_by: user.id
      })
      .eq('id', issueId)
      .select()
      .single();

    if (updateError) {
      console.error('Error acknowledging issue:', updateError);
      return NextResponse.json({ error: 'Failed to acknowledge issue' }, { status: 500 });
    }

    // Get acknowledger name for audit log
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const acknowledgerName = userData?.name || userData?.email || user.id;

    // Create audit log entry
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: issueId,
        user_id: user.id,
        action: 'acknowledged',
        details: {
          acknowledged_by: user.id,
          acknowledged_by_name: acknowledgerName,
          acknowledged_at: now
        }
      });

    return NextResponse.json({
      ...updatedIssue,
      acknowledged_at: now,
      acknowledged_by: user.id
    });
  } catch (error) {
    console.error('Acknowledge issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
