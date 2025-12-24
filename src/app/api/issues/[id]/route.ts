import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { updateIssue } from '@/lib/care-coordination';

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

    const { data: issue, error } = await supabase
      .from('issues')
      .select(`
        *,
        patient:patients(id, mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching issue:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Fetch reporter and assignee from public.users table
    const userIds = [issue.reported_by, issue.assigned_to].filter(Boolean);
    let usersMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', userIds);
      
      if (usersData) {
        usersMap = usersData.reduce((acc, u) => {
          acc[u.id] = u;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Enrich issue with reporter and assignee data
    const enrichedIssue = {
      ...issue,
      reporter: issue.reported_by ? usersMap[issue.reported_by] || null : null,
      assignee: issue.assigned_to ? usersMap[issue.assigned_to] || null : null,
    };

    return NextResponse.json(enrichedIssue);
  } catch (error) {
    console.error('Fetch issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const issue = await updateIssue(params.id, body);

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
