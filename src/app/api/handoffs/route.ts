import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';

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
    const creatorIds = [...new Set(data?.filter(d => d.created_by).map(d => d.created_by) || [])];
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
    const { shift_start, shift_end, notes, tagged_issues } = body;

    if (!shift_start || !shift_end) {
      return NextResponse.json({ error: 'Shift start and end are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('handoffs')
      .insert({
        created_by: user.id,
        shift_start,
        shift_end,
        notes,
        tagged_issues
      })
      .select()
      .single();

    if (error) throw error;

    // Create audit log entries for each tagged issue
    if (tagged_issues && tagged_issues.length > 0) {
      const auditEntries = tagged_issues.map((issueId: string) => ({
        issue_id: issueId,
        user_id: user.id,
        action: 'handoff_created',
        details: {
          handoff_id: data.id,
          shift_start,
          shift_end,
          tagged_count: tagged_issues.length
        }
      }));

      await supabase.from('issue_audit_log').insert(auditEntries);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Create handoff error:', error);
    return NextResponse.json({ error: 'Failed to create handoff' }, { status: 500 });
  }
}
