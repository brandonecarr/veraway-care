import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import { createIssue, getIssues } from '@/lib/care-coordination';
import { notifyNewIssue, getUserFacilityId } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patient_id = searchParams.get('patient_id');
    const status = searchParams.get('status');
    const includeResolved = searchParams.get('includeResolved') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const filters: any = { includeResolved };
    if (patient_id) {
      filters.patient_id = patient_id;
    }
    if (status) {
      filters.status = status;
    }
    if (limit) {
      filters.limit = limit;
    }
    if (offset !== undefined) {
      filters.offset = offset;
    }

    const issues = await getIssues(filters);
    return NextResponse.json(issues || []);
  } catch (error) {
    console.error('Get issues error:', error);
    // Return empty array on error so dashboard still renders
    return NextResponse.json([]);
  }
}

// Issue types that update patient date columns
const PATIENT_DATE_ISSUE_TYPES: Record<string, string> = {
  'Discharged': 'discharge_date',
  'Death': 'death_date'
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_timestamp, ...issueData } = body;

    const issue = await createIssue({
      ...issueData,
      reported_by: user.id
    });

    // If this is an Admitted, Discharged, or Death issue, update the patient record
    const patientDateColumn = PATIENT_DATE_ISSUE_TYPES[issueData.issue_type];
    if (patientDateColumn && event_timestamp && issueData.patient_id) {
      const { error: patientUpdateError } = await supabase
        .from('patients')
        .update({ [patientDateColumn]: event_timestamp })
        .eq('id', issueData.patient_id);

      if (patientUpdateError) {
        console.error(`Failed to update patient ${patientDateColumn}:`, patientUpdateError);
      }
    }

    // Fetch patient details for the notification
    const { data: patient } = await supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', issueData.patient_id)
      .single();

    // Send notifications to all facility users (fire and forget)
    const facilityId = await getUserFacilityId(user.id);
    if (facilityId && patient) {
      notifyNewIssue(user.id, facilityId, {
        id: issue.id,
        issue_number: issue.issue_number,
        issue_type: issue.issue_type,
        description: issue.description,
      }, {
        first_name: patient.first_name,
        last_name: patient.last_name,
      }).catch((err) => console.error('Failed to send issue notification:', err));
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Create issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
