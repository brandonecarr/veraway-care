import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';

// IDG Issue Types that warrant automatic inclusion
const IDG_ISSUE_TYPES = [
  'Change in Condition',
  'Death',
  'Infection',
  'Incident',
  'Unmanaged Pain',
  'Missed/Declined Visit',
  'Not Following Plan-of-Care'
];

// Disciplines available for IDG attendance
const IDG_DISCIPLINES = [
  'Physician/NP',
  'RN Case Manager',
  'Social Worker',
  'Chaplain',
  'Hospice Aide',
  'Bereavement Coordinator',
  'Volunteer Coordinator',
  'Medical Director',
  'Administrator'
];

// IDG Disposition options
const IDG_DISPOSITIONS = [
  { value: 'monitoring_only', label: 'Monitoring Only' },
  { value: 'plan_in_place', label: 'Plan in Place' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'pending_md_input', label: 'Pending MD Input' },
  { value: 'resolved', label: 'Resolved' }
];

interface IDGIssue {
  id: string;
  issue_number: number;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  issue_type: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  assignee_name: string;
  assignee_job_role: string | null;
  reported_by: string;
  reporter_name: string;
  hours_open: number;
  is_overdue: boolean;
  idg_reason: string;
  actions_taken?: any[];
  outstanding_next_steps?: any[];
  // IDG-specific fields
  flagged_for_md_review?: boolean;
  idg_disposition?: string | null;
  reviewed_in_idg?: boolean;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's facility
    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    // Check if user is coordinator
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden - Coordinators only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');
    const thresholdHours = parseInt(searchParams.get('threshold') || '24');
    const groupBy = searchParams.get('groupBy') || 'patient';

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: 'weekStart and weekEnd are required' }, { status: 400 });
    }

    // Try RPC function first, fall back to direct query if not available
    let idgIssues: IDGIssue[] = [];

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_idg_issues', {
      p_week_start: weekStart,
      p_week_end: weekEnd,
      p_threshold_hours: thresholdHours
    });

    if (rpcError) {
      // Fallback to direct query
      idgIssues = await fallbackQuery(supabase, weekStart, weekEnd, thresholdHours);
    } else {
      idgIssues = rpcData || [];
    }

    // Get actions and messages for these issues
    const issueIds = idgIssues.map(i => i.id);

    if (issueIds.length > 0) {
      // Get audit actions
      const { data: actionsData } = await supabase.rpc('get_idg_issue_actions', {
        p_issue_ids: issueIds
      });

      // Get messages
      const { data: messagesData } = await supabase.rpc('get_idg_issue_messages', {
        p_issue_ids: issueIds
      });

      // Get IDG issue statuses (flags, dispositions)
      const { data: statusData } = await supabase.rpc('get_idg_issue_statuses', {
        p_issue_ids: issueIds
      });

      // Create lookup maps
      const actionsMap: Record<string, any[]> = {};
      const messagesMap: Record<string, any[]> = {};
      const statusMap: Record<string, { flagged_for_md_review: boolean; idg_disposition: string | null; reviewed_in_idg: boolean }> = {};

      if (actionsData) {
        actionsData.forEach((row: { issue_id: string; actions: any[] }) => {
          actionsMap[row.issue_id] = row.actions || [];
        });
      }

      if (messagesData) {
        messagesData.forEach((row: { issue_id: string; messages: any[] }) => {
          messagesMap[row.issue_id] = row.messages || [];
        });
      }

      if (statusData) {
        statusData.forEach((row: { issue_id: string; flagged_for_md_review: boolean; idg_disposition: string | null; reviewed_in_idg: boolean }) => {
          statusMap[row.issue_id] = {
            flagged_for_md_review: row.flagged_for_md_review,
            idg_disposition: row.idg_disposition,
            reviewed_in_idg: row.reviewed_in_idg
          };
        });
      }

      // Enrich issues with actions, messages, and IDG status
      idgIssues = idgIssues.map(issue => ({
        ...issue,
        actions_taken: actionsMap[issue.id] || [],
        outstanding_next_steps: messagesMap[issue.id] || [],
        flagged_for_md_review: statusMap[issue.id]?.flagged_for_md_review || false,
        idg_disposition: statusMap[issue.id]?.idg_disposition || null,
        reviewed_in_idg: statusMap[issue.id]?.reviewed_in_idg || false
      }));
    }

    // Group issues
    const grouped = groupIssues(idgIssues, groupBy);

    // Get admissions and deaths counts
    let admissionsCount = 0;
    let deathsCount = 0;

    // Count deaths from the issues
    deathsCount = idgIssues.filter(i => i.issue_type === 'Death').length;

    // Try to get admissions count from patients table
    if (userData?.facility_id) {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('facility_id', userData.facility_id)
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd)
        .eq('status', 'active');

      admissionsCount = count || 0;
    }

    // Check if this week has been reviewed already
    let previousReview = null;
    if (userData?.facility_id) {
      const { data: reviewData } = await supabase
        .from('idg_reviews')
        .select('*')
        .eq('facility_id', userData.facility_id)
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      previousReview = reviewData;
    }

    // Calculate summary statistics
    const summary = {
      totalIssues: idgIssues.length,
      byPriority: {
        urgent: idgIssues.filter(i => i.priority === 'urgent').length,
        high: idgIssues.filter(i => i.priority === 'high').length,
        normal: idgIssues.filter(i => i.priority === 'normal').length,
        low: idgIssues.filter(i => i.priority === 'low').length
      },
      byStatus: {
        open: idgIssues.filter(i => i.status === 'open').length,
        in_progress: idgIssues.filter(i => i.status === 'in_progress').length
      },
      overdue: idgIssues.filter(i => i.is_overdue).length,
      admissions: admissionsCount,
      deaths: deathsCount,
      flaggedForMD: idgIssues.filter(i => i.flagged_for_md_review).length,
      byIssueType: IDG_ISSUE_TYPES.reduce((acc, type) => {
        acc[type] = idgIssues.filter(i => i.issue_type === type).length;
        return acc;
      }, {} as Record<string, number>),
      weekRange: { start: weekStart, end: weekEnd },
      thresholdHours
    };

    return NextResponse.json({
      issues: idgIssues,
      grouped,
      summary,
      previousReview,
      disciplines: IDG_DISCIPLINES,
      dispositions: IDG_DISPOSITIONS,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('IDG Review API error:', error);
    return NextResponse.json({ error: 'Failed to fetch IDG issues' }, { status: 500 });
  }
}

// PATCH - Update issue IDG status (flag for MD, set disposition)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's facility
    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    // Check if user is coordinator
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden - Coordinators only' }, { status: 403 });
    }

    const body = await request.json();
    const { issueId, flaggedForMDReview, disposition } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
    }

    // Update the IDG issue status
    const { data, error } = await supabase.rpc('update_idg_issue_disposition', {
      p_issue_id: issueId,
      p_facility_id: userData?.facility_id,
      p_user_id: user.id,
      p_disposition: disposition || null,
      p_flagged_for_md: flaggedForMDReview !== undefined ? flaggedForMDReview : null
    });

    if (error) {
      // Fallback: direct insert/update
      const { error: upsertError } = await supabase
        .from('idg_issue_status')
        .upsert({
          issue_id: issueId,
          facility_id: userData?.facility_id,
          flagged_for_md_review: flaggedForMDReview,
          flagged_for_md_review_at: flaggedForMDReview !== undefined ? new Date().toISOString() : undefined,
          flagged_for_md_review_by: flaggedForMDReview !== undefined ? user.id : undefined,
          idg_disposition: disposition,
          disposition_set_at: disposition ? new Date().toISOString() : undefined,
          disposition_set_by: disposition ? user.id : undefined,
          updated_at: new Date().toISOString()
        }, { onConflict: 'issue_id' });

      if (upsertError) {
        console.error('Fallback upsert error:', upsertError);
        return NextResponse.json({ error: 'Failed to update issue status' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('IDG Review PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update issue status' }, { status: 500 });
  }
}

// POST - Complete IDG Review
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's facility
    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    // Check if user is coordinator
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden - Coordinators only' }, { status: 403 });
    }

    const body = await request.json();
    const { weekStart, weekEnd, disciplinesPresent, issueIds, admissionsCount, deathsCount } = body;

    if (!weekStart || !weekEnd || !disciplinesPresent || !issueIds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try RPC first
    const { data, error } = await supabase.rpc('complete_idg_review', {
      p_facility_id: userData?.facility_id,
      p_user_id: user.id,
      p_user_role: roleData?.role || 'coordinator',
      p_week_start: weekStart,
      p_week_end: weekEnd,
      p_disciplines_present: disciplinesPresent,
      p_issue_ids: issueIds,
      p_admissions_count: admissionsCount || 0,
      p_deaths_count: deathsCount || 0
    });

    if (error) {
      // Fallback: direct insert
      const { data: reviewData, error: insertError } = await supabase
        .from('idg_reviews')
        .insert({
          facility_id: userData?.facility_id,
          week_start: weekStart,
          week_end: weekEnd,
          completed_by: user.id,
          completed_by_role: roleData?.role || 'coordinator',
          disciplines_present: disciplinesPresent,
          total_issues_reviewed: issueIds.length,
          admissions_count: admissionsCount || 0,
          deaths_count: deathsCount || 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('Fallback insert error:', insertError);
        return NextResponse.json({ error: 'Failed to complete IDG review' }, { status: 500 });
      }

      // Mark issues as reviewed
      if (reviewData && issueIds.length > 0) {
        for (const issueId of issueIds) {
          await supabase
            .from('idg_issue_status')
            .upsert({
              issue_id: issueId,
              facility_id: userData?.facility_id,
              reviewed_in_idg: true,
              reviewed_in_idg_at: new Date().toISOString(),
              idg_review_id: reviewData.id,
              updated_at: new Date().toISOString()
            }, { onConflict: 'issue_id' });
        }
      }

      return NextResponse.json({ success: true, review: reviewData });
    }

    return NextResponse.json({ success: true, review: data });
  } catch (error) {
    console.error('IDG Review POST error:', error);
    return NextResponse.json({ error: 'Failed to complete IDG review' }, { status: 500 });
  }
}

function groupIssues(issues: IDGIssue[], groupBy: string): Record<string, any> {
  if (groupBy === 'issue_type') {
    const grouped: Record<string, IDGIssue[]> = {};
    issues.forEach(issue => {
      const key = issue.issue_type;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(issue);
    });
    return grouped;
  }

  // Default: group by patient
  const grouped: Record<string, { patient_id: string; patient_name: string; patient_mrn: string; issues: IDGIssue[] }> = {};
  issues.forEach(issue => {
    const key = issue.patient_id;
    if (!grouped[key]) {
      grouped[key] = {
        patient_id: issue.patient_id,
        patient_name: issue.patient_name,
        patient_mrn: issue.patient_mrn,
        issues: []
      };
    }
    grouped[key].issues.push(issue);
  });
  return grouped;
}

async function fallbackQuery(
  supabase: any,
  weekStart: string,
  weekEnd: string,
  thresholdHours: number
): Promise<IDGIssue[]> {
  // Direct query fallback if RPC is not available
  const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('issues')
    .select(`
      id,
      issue_number,
      patient_id,
      issue_type,
      description,
      status,
      priority,
      created_at,
      updated_at,
      assigned_to,
      reported_by,
      patient:patients(id, first_name, last_name, mrn),
      assignee:users!issues_assigned_to_fkey(id, name, email),
      reporter:users!issues_reported_by_fkey(id, name, email)
    `)
    .in('status', ['open', 'in_progress'])
    .lte('created_at', weekEnd)
    .or(`priority.in.(high,urgent),issue_type.in.(${IDG_ISSUE_TYPES.map(t => `"${t}"`).join(',')}),created_at.lt.${thresholdDate}`)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fallback query error:', error);
    return [];
  }

  // Transform to expected format
  return (data || []).map((issue: any) => {
    const hoursOpen = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    const isHighPriority = ['high', 'urgent'].includes(issue.priority);
    const isIdgType = IDG_ISSUE_TYPES.includes(issue.issue_type);
    const isOverdue = hoursOpen > thresholdHours;

    return {
      id: issue.id,
      issue_number: issue.issue_number,
      patient_id: issue.patient_id,
      patient_name: issue.patient ? `${issue.patient.first_name} ${issue.patient.last_name}` : 'Unknown Patient',
      patient_mrn: issue.patient?.mrn || '',
      issue_type: issue.issue_type,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      assigned_to: issue.assigned_to,
      assignee_name: issue.assignee?.name || issue.assignee?.email?.split('@')[0] || 'Unassigned',
      assignee_job_role: null,
      reported_by: issue.reported_by,
      reporter_name: issue.reporter?.name || issue.reporter?.email?.split('@')[0] || 'Unknown',
      hours_open: Math.round(hoursOpen * 10) / 10,
      is_overdue: isOverdue,
      idg_reason: isHighPriority ? 'High/Urgent Priority' : isIdgType ? 'IDG Issue Type' : `Unresolved > ${thresholdHours}h`,
      actions_taken: [],
      outstanding_next_steps: [],
      flagged_for_md_review: false,
      idg_disposition: null,
      reviewed_in_idg: false
    };
  });
}
