import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId');

  try {
    let query = supabase
      .from('issue_audit_log')
      .select(`
        *,
        issue:issues(id, issue_number, status, patient:patients(id, first_name, last_name))
      `)
      .order('created_at', { ascending: false });

    if (issueId) {
      query = query.eq('issue_id', issueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Collect all user IDs - both user_id and assigned_to from details
    const userIds = new Set<string>();
    data?.forEach(d => {
      if (d.user_id) userIds.add(d.user_id);
      if (d.details?.assigned_to) userIds.add(d.details.assigned_to);
    });
    
    let usersMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', Array.from(userIds));
      
      if (usersData) {
        usersMap = usersData.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Merge user data into audit entries, including assigned_to user
    const enrichedData = data?.map(entry => ({
      ...entry,
      user: entry.user_id ? usersMap[entry.user_id] : null,
      assigned_to_user: entry.details?.assigned_to ? usersMap[entry.details.assigned_to] : null
    }));

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
