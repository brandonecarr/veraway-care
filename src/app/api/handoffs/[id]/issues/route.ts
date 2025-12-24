import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';

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

    // Get handoff
    const { data: handoff, error: handoffError } = await supabase
      .from('handoffs')
      .select('*')
      .eq('id', params.id)
      .single();

    if (handoffError || !handoff) {
      return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
    }

    // Fetch tagged issues with patient data
    let taggedIssues: any[] = [];
    if (handoff.tagged_issues && handoff.tagged_issues.length > 0) {
      const { data: issuesData } = await supabase
        .from('issues')
        .select(`
          *,
          patient:patients(*)
        `)
        .in('id', handoff.tagged_issues);
      
      if (issuesData) {
        // Fetch assignee data
        const assigneeIds = [...new Set(issuesData.filter(i => i.assigned_to).map(i => i.assigned_to))];
        let assigneesMap: Record<string, any> = {};
        
        if (assigneeIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', assigneeIds);
          
          if (usersData) {
            assigneesMap = usersData.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        taggedIssues = issuesData.map(issue => ({
          ...issue,
          assignee: issue.assigned_to ? assigneesMap[issue.assigned_to] : null
        }));
      }
    }

    return NextResponse.json(taggedIssues);
  } catch (error) {
    console.error('Get handoff issues error:', error);
    return NextResponse.json({ error: 'Failed to fetch handoff issues' }, { status: 500 });
  }
}
