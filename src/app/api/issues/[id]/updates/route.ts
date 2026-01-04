import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { notifyIssueUpdate, getUserFacilityId } from '@/lib/notifications';

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
    const body = await request.json();
    const { note } = body;

    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    // Update last_activity_at to reset the overdue timer
    const newLastActivityAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('issues')
      .update({ last_activity_at: newLastActivityAt })
      .eq('id', issueId);

    if (updateError) {
      console.error('Failed to update last_activity_at:', updateError);
    }

    // Create audit log entry
    const { error } = await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: issueId,
        user_id: user.id,
        action: 'updated',
        details: {
          note
        }
      });

    if (error) throw error;

    // Fetch issue and patient details for the notification
    const { data: issue } = await supabase
      .from('issues')
      .select('issue_number, patient:patients(first_name, last_name)')
      .eq('id', issueId)
      .single();

    // Send notifications to all facility users (fire and forget)
    const facilityId = await getUserFacilityId(user.id);
    if (facilityId && issue && issue.patient) {
      const patient = Array.isArray(issue.patient) ? issue.patient[0] : issue.patient;
      notifyIssueUpdate(user.id, facilityId, {
        id: issueId,
        issue_number: issue.issue_number,
      }, {
        first_name: patient.first_name,
        last_name: patient.last_name,
      }, note).catch((err) => console.error('Failed to send issue update notification:', err));
    }

    return NextResponse.json({ success: true, last_activity_at: newLastActivityAt });
  } catch (error) {
    console.error('Add update error:', error);
    return NextResponse.json({ error: 'Failed to add update' }, { status: 500 });
  }
}
