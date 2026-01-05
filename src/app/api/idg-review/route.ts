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

// Helper function to format patient data for PDF export
function formatPatientForPDF(patient: any, userMap?: Map<string, { name: string; job_role: string }>) {
  const admittedDate = patient.admitted_date || patient.admission_date;
  let daysRemaining: number | null = null;

  if (admittedDate && patient.benefit_period) {
    const admitted = new Date(admittedDate);
    const daysInPeriod = patient.benefit_period <= 2 ? 90 : 60;
    const endDate = new Date(admitted.getTime() + daysInPeriod * 24 * 60 * 60 * 1000);
    daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  // Look up RN case manager info from the user map
  let rnCaseManager = null;
  if (patient.rn_case_manager_id && userMap) {
    const user = userMap.get(patient.rn_case_manager_id);
    if (user) {
      rnCaseManager = { name: user.name, job_role: user.job_role };
    }
  }

  return {
    id: patient.id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    mrn: patient.mrn,
    date_of_birth: patient.date_of_birth,
    diagnosis: patient.diagnosis,
    level_of_care: patient.level_of_care,
    residence_type: patient.residence_type,
    benefit_period: patient.benefit_period,
    admission_date: admittedDate,
    discharge_date: patient.discharge_date,
    death_date: patient.death_date,
    rn_case_manager: rnCaseManager,
    days_remaining: daysRemaining
  };
}

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
  idg_reasons: string[];
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

    // Get user's hospice
    const { data: userData } = await supabase
      .from('users')
      .select('hospice_id')
      .eq('id', user.id)
      .single();

    // Get hospice name
    let hospiceName = '';
    if (userData?.hospice_id) {
      const { data: hospiceData } = await supabase
        .from('hospices')
        .select('name')
        .eq('id', userData.hospice_id)
        .single();
      hospiceName = hospiceData?.name || '';
    }

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
    // Support both old (weekStart/weekEnd) and new (fromDate/toDate) params
    const fromDate = searchParams.get('fromDate') || searchParams.get('weekStart');
    const toDate = searchParams.get('toDate') || searchParams.get('weekEnd');
    const thresholdHours = parseInt(searchParams.get('threshold') || '24');
    const groupBy = searchParams.get('groupBy') || 'patient';

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 });
    }

    // Try RPC function first, fall back to direct query if not available
    let idgIssues: IDGIssue[] = [];

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_idg_issues', {
      p_week_start: fromDate,
      p_week_end: toDate,
      p_threshold_hours: thresholdHours
    });

    if (rpcError) {
      // Fallback to direct query
      idgIssues = await fallbackQuery(supabase, fromDate, toDate, thresholdHours);
    } else {
      // Transform RPC data to ensure idg_reasons is an array
      idgIssues = (rpcData || []).map((issue: any) => {
        // Convert idg_reason string to idg_reasons array if needed
        let idgReasons: string[] = issue.idg_reasons || [];
        if (!idgReasons.length && issue.idg_reason) {
          // Parse from single reason string - build array based on issue properties
          const reasons: string[] = [];
          const isHighPriority = ['high', 'urgent'].includes(issue.priority);
          const isIdgType = IDG_ISSUE_TYPES.includes(issue.issue_type);
          const isOverdue = issue.is_overdue;

          if (isHighPriority) {
            reasons.push(issue.priority === 'urgent' ? 'Urgent Priority' : 'High Priority');
          }
          if (isIdgType) {
            reasons.push(issue.issue_type);
          }
          if (isOverdue) {
            reasons.push(`Unresolved > ${thresholdHours}h`);
          }
          idgReasons = reasons.length > 0 ? reasons : [issue.idg_reason];
        }
        return {
          ...issue,
          idg_reasons: idgReasons
        };
      });
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

    // Define patient select fields for PDF export
    // Note: rn_case_manager_id references auth.users, so we look up user info separately
    const patientSelectFields = `
      id, first_name, last_name, mrn, date_of_birth, diagnosis,
      level_of_care, residence_type, benefit_period, admitted_date, admission_date,
      discharge_date, death_date, rn_case_manager_id
    `;

    // Get patient data for the summary stats and PDF export
    let totalActivePatients = 0;
    let admissionsCount = 0;
    let dischargesCount = 0;
    let deathsCount = 0;
    let admissionsPatients: any[] = [];
    let dischargesPatients: any[] = [];
    let censusPatients: any[] = [];
    let userMap = new Map<string, { name: string; job_role: string }>();

    if (userData?.hospice_id) {
      // Get all active patients (for census and counts)
      const { data: activePatients, count: activeCount } = await supabase
        .from('patients')
        .select(patientSelectFields, { count: 'exact' })
        .eq('hospice_id', userData.hospice_id)
        .eq('status', 'active');

      totalActivePatients = activeCount || 0;

      // Get admissions in date range (using admitted_date)
      const { data: admissions } = await supabase
        .from('patients')
        .select(patientSelectFields)
        .eq('hospice_id', userData.hospice_id)
        .gte('admitted_date', fromDate)
        .lte('admitted_date', toDate);

      // Get discharges in date range (using discharge_date)
      const { data: discharges } = await supabase
        .from('patients')
        .select(patientSelectFields)
        .eq('hospice_id', userData.hospice_id)
        .gte('discharge_date', fromDate)
        .lte('discharge_date', toDate);

      // Collect all unique rn_case_manager_ids
      const allPatients = [...(activePatients || []), ...(admissions || []), ...(discharges || [])];
      const rnCaseManagerIds = Array.from(new Set(allPatients.map(p => p.rn_case_manager_id).filter(Boolean)));

      // Fetch user info for RN case managers
      if (rnCaseManagerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, job_role')
          .in('id', rnCaseManagerIds);

        if (users) {
          users.forEach(u => userMap.set(u.id, { name: u.name || '', job_role: u.job_role || '' }));
        }
      }

      // Format patients with user info
      censusPatients = (activePatients || []).map(p => formatPatientForPDF(p, userMap));
      admissionsPatients = (admissions || []).map(p => formatPatientForPDF(p, userMap));
      admissionsCount = admissionsPatients.length;
      dischargesPatients = (discharges || []).map(p => formatPatientForPDF(p, userMap));
      dischargesCount = dischargesPatients.length;

      // Get deaths in date range (using death_date)
      const { count: deaths } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('hospice_id', userData.hospice_id)
        .gte('death_date', fromDate)
        .lte('death_date', toDate);

      deathsCount = deaths || 0;
    }

    // Get patients with benefit periods expiring within 14 days
    let expiringBenefitPeriods: any[] = [];
    if (userData?.hospice_id) {
      // Get active patients with benefit period and admitted_date (with full data for PDF)
      const { data: patientsData } = await supabase
        .from('patients')
        .select(patientSelectFields)
        .eq('hospice_id', userData.hospice_id)
        .eq('status', 'active')
        .not('admitted_date', 'is', null)
        .not('benefit_period', 'is', null);

      if (patientsData) {
        // Calculate days remaining for each patient and filter for ≤14 days
        const now = new Date();
        expiringBenefitPeriods = patientsData
          .map(patient => {
            const admittedDate = new Date(patient.admitted_date);
            const daysInPeriod = patient.benefit_period <= 2 ? 90 : 60;
            const endDate = new Date(admittedDate.getTime() + daysInPeriod * 24 * 60 * 60 * 1000);
            const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

            return {
              ...formatPatientForPDF(patient, userMap),
              patient_id: patient.id,
              patient_name: `${patient.first_name} ${patient.last_name}`,
              patient_mrn: patient.mrn,
              days_remaining: daysRemaining,
              end_date: endDate.toISOString()
            };
          })
          .filter(p => p.days_remaining <= 14)
          .sort((a, b) => a.days_remaining - b.days_remaining);
      }
    }

    // Check if this date range has been reviewed already
    let previousReview = null;
    if (userData?.hospice_id) {
      const { data: reviewData } = await supabase
        .from('idg_reviews')
        .select('*')
        .eq('hospice_id', userData.hospice_id)
        .eq('week_start', fromDate)
        .eq('week_end', toDate)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      previousReview = reviewData;
    }

    // Calculate high priority and overdue count
    const highPriorityOverdueCount = idgIssues.filter(i =>
      ['high', 'urgent'].includes(i.priority) || i.is_overdue
    ).length;

    // Calculate summary statistics (new format for IDG summary stats)
    const summary = {
      // New stats for updated UI
      totalActivePatients,
      admissionsThisWeek: admissionsCount,
      dischargesThisWeek: dischargesCount,
      deathsThisWeek: deathsCount,
      totalIssuesIncluded: 0, // Will be set by client after issue selection
      highPriorityOverdueCount,
      // Keep legacy stats for backwards compatibility
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
      flaggedForMD: idgIssues.filter(i => i.flagged_for_md_review).length,
      expiringBenefitPeriods: expiringBenefitPeriods.length,
      byIssueType: IDG_ISSUE_TYPES.reduce((acc, type) => {
        acc[type] = idgIssues.filter(i => i.issue_type === type).length;
        return acc;
      }, {} as Record<string, number>),
      dateRange: { start: fromDate, end: toDate },
      thresholdHours
    };

    return NextResponse.json({
      issues: idgIssues,
      grouped,
      summary,
      expiringBenefitPeriods,
      previousReview,
      disciplines: IDG_DISCIPLINES,
      dispositions: IDG_DISPOSITIONS,
      generatedAt: new Date().toISOString(),
      // PDF export data
      hospiceName,
      admissionsPatients,
      dischargesPatients,
      censusPatients,
      totalCensusCount: totalActivePatients
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

    // Get user's hospice
    const { data: userData } = await supabase
      .from('users')
      .select('hospice_id')
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
    const { issueId, flaggedForMD, disposition } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
    }

    // Update the IDG issue status
    const { data, error } = await supabase.rpc('update_idg_issue_disposition', {
      p_issue_id: issueId,
      p_hospice_id: userData?.hospice_id,
      p_user_id: user.id,
      p_disposition: disposition || null,
      p_flagged_for_md: flaggedForMD !== undefined ? flaggedForMD : null
    });

    if (error) {
      // Fallback: direct insert/update
      const { error: upsertError } = await supabase
        .from('idg_issue_status')
        .upsert({
          issue_id: issueId,
          hospice_id: userData?.hospice_id,
          flagged_for_md_review: flaggedForMD,
          flagged_for_md_review_at: flaggedForMD !== undefined ? new Date().toISOString() : undefined,
          flagged_for_md_review_by: flaggedForMD !== undefined ? user.id : undefined,
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

    // Get user's hospice
    const { data: userData } = await supabase
      .from('users')
      .select('hospice_id')
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
    const {
      weekStart,
      weekEnd,
      fromDate: bodyFromDate,
      toDate: bodyToDate,
      disciplinesPresent,
      issueIds,
      selectedIssueIds,
      meetingStartedAt,
      admissionsCount,
      deathsCount
    } = body;

    // Support both old and new parameter names
    const finalFromDate = bodyFromDate || weekStart;
    const finalToDate = bodyToDate || weekEnd;
    const finalIssueIds = selectedIssueIds || issueIds;

    if (!finalFromDate || !finalToDate || !disciplinesPresent || !finalIssueIds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try RPC first
    const { data, error } = await supabase.rpc('complete_idg_review', {
      p_hospice_id: userData?.hospice_id,
      p_user_id: user.id,
      p_user_role: roleData?.role || 'coordinator',
      p_week_start: finalFromDate,
      p_week_end: finalToDate,
      p_disciplines_present: disciplinesPresent,
      p_issue_ids: finalIssueIds,
      p_admissions_count: admissionsCount || 0,
      p_deaths_count: deathsCount || 0
    });

    if (error) {
      // Fallback: direct insert
      const { data: reviewData, error: insertError } = await supabase
        .from('idg_reviews')
        .insert({
          hospice_id: userData?.hospice_id,
          week_start: finalFromDate,
          week_end: finalToDate,
          completed_by: user.id,
          completed_by_role: roleData?.role || 'coordinator',
          disciplines_present: disciplinesPresent,
          total_issues_reviewed: finalIssueIds.length,
          admissions_count: admissionsCount || 0,
          deaths_count: deathsCount || 0,
          meeting_started_at: meetingStartedAt || null,
          selected_issue_ids: finalIssueIds
        })
        .select()
        .single();

      if (insertError) {
        console.error('Fallback insert error:', insertError);
        return NextResponse.json({ error: 'Failed to complete IDG review' }, { status: 500 });
      }

      // Mark issues as reviewed
      if (reviewData && finalIssueIds.length > 0) {
        for (const issueId of finalIssueIds) {
          await supabase
            .from('idg_issue_status')
            .upsert({
              issue_id: issueId,
              hospice_id: userData?.hospice_id,
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

    // Build array of all applicable IDG reasons
    const idgReasons: string[] = [];
    if (isHighPriority) {
      idgReasons.push(issue.priority === 'urgent' ? 'Urgent Priority' : 'High Priority');
    }
    if (isIdgType) {
      idgReasons.push(issue.issue_type);
    }
    if (isOverdue) {
      idgReasons.push(`Unresolved > ${thresholdHours}h`);
    }

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
      idg_reasons: idgReasons,
      actions_taken: [],
      outstanding_next_steps: [],
      flagged_for_md_review: false,
      idg_disposition: null,
      reviewed_in_idg: false
    };
  });
}
