import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import { sendPushNotificationToMultipleUsers } from '@/lib/push-notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('handoffs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch creator details
    const creatorIds = Array.from(new Set(data?.filter(d => d.created_by).map(d => d.created_by) || []));
    let creatorsMap: Record<string, any> = {};
    
    if (creatorIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', creatorIds);
      
      if (usersData) {
        creatorsMap = usersData.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    const enrichedData = data?.map(handoff => ({
      ...handoff,
      creator: handoff.created_by ? creatorsMap[handoff.created_by] : null
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Get handoffs error:', error);
    return NextResponse.json({ error: 'Failed to fetch handoffs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notes, tagged_issues } = body;

    // Get the current user's facility
    const { data: currentUser } = await supabase
      .from('users')
      .select('facility_id, name, email')
      .eq('id', user.id)
      .single();

    if (!currentUser?.facility_id) {
      return NextResponse.json({ error: 'User facility not found' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('handoffs')
      .insert({
        created_by: user.id,
        notes,
        tagged_issues
      })
      .select()
      .single();

    if (error) throw error;

    // Create audit log entries for each tagged issue (non-blocking)
    if (tagged_issues && tagged_issues.length > 0) {
      try {
        const auditEntries = tagged_issues.map((issueId: string) => ({
          issue_id: issueId,
          user_id: user.id,
          action: 'after_shift_report_created',
          details: {
            handoff_id: data.id,
            tagged_count: tagged_issues.length
          }
        }));

        await supabase.from('issue_audit_log').insert(auditEntries);
      } catch (auditError) {
        console.error('Failed to create audit log entries:', auditError);
      }
    }

    // Get all users in the same facility for notifications (non-blocking)
    try {
      const { data: facilityUsers } = await supabase
        .from('users')
        .select('id')
        .eq('facility_id', currentUser.facility_id)
        .neq('id', user.id); // Don't notify the creator

      if (facilityUsers && facilityUsers.length > 0) {
        const creatorName = currentUser.name || currentUser.email?.split('@')[0] || 'A team member';
        const issueCount = tagged_issues?.length || 0;

        // Create in-app notifications for all facility staff
        const notifications = facilityUsers.map((u: { id: string }) => ({
          user_id: u.id,
          type: 'handoff',
          title: 'New After Shift Report',
          message: `${creatorName} has submitted a new After Shift Report with ${issueCount} tagged issue${issueCount !== 1 ? 's' : ''}`,
          related_handoff_id: data.id,
          metadata: { push_priority: 'normal' }
        }));

        await supabase.from('notifications').insert(notifications);

        // Send push notifications to all facility users
        const userIds = facilityUsers.map((u: { id: string }) => u.id);
        await sendPushNotificationToMultipleUsers(userIds, {
          title: 'New After Shift Report',
          body: `${issueCount} issue${issueCount !== 1 ? 's' : ''} require${issueCount === 1 ? 's' : ''} attention`,
          url: '/dashboard/after-shift-reports',
          tag: 'after-shift-report'
        });
      }
    } catch (notifyError) {
      console.error('Failed to send notifications:', notifyError);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create after shift report error:', error);
    return NextResponse.json({ error: 'Failed to create after shift report' }, { status: 500 });
  }
}
