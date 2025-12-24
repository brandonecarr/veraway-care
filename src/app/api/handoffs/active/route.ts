import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Get the most recent handoff that covers the current time
    const { data: handoff, error } = await supabase
      .from('handoffs')
      .select('*')
      .lte('shift_start', now)
      .gte('shift_end', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!handoff) {
      return NextResponse.json(null);
    }

    // Fetch creator details
    let creator = null;
    if (handoff.created_by) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', handoff.created_by)
        .single();
      creator = userData;
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

    return NextResponse.json({
      handoff: {
        ...handoff,
        creator
      },
      taggedIssues
    });
  } catch (error) {
    console.error('Get active handoff error:', error);
    return NextResponse.json({ error: 'Failed to fetch active handoff' }, { status: 500 });
  }
}
