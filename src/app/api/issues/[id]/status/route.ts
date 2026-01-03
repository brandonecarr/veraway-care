import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { notifyIssueStatusChange, getUserFacilityId } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const body = await request.json();
    const { status, note } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Get current issue to track old status and patient info
    const { data: currentIssue } = await supabase
      .from('issues')
      .select('status, issue_number, patient:patients(first_name, last_name)')
      .eq('id', issueId)
      .single();

    // Update the issue status
    const { data: issue, error } = await supabase
      .from('issues')
      .update({ status })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: issueId,
        user_id: user.id,
        action: 'status_changed',
        details: {
          old_status: currentIssue?.status,
          new_status: status,
          note: note || undefined
        }
      });

    // Send notifications to all facility users (fire and forget)
    const facilityId = await getUserFacilityId(user.id);
    if (facilityId && currentIssue && currentIssue.patient) {
      const patient = Array.isArray(currentIssue.patient) ? currentIssue.patient[0] : currentIssue.patient;
      notifyIssueStatusChange(user.id, facilityId, {
        id: issueId,
        issue_number: currentIssue.issue_number,
      }, {
        first_name: patient.first_name,
        last_name: patient.last_name,
      }, currentIssue.status, status).catch((err) => console.error('Failed to send status change notification:', err));
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
