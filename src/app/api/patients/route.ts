import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import { getPatients } from '@/lib/care-coordination';
import { notifyNewPatient, getUserHospiceId } from '@/lib/notifications';
import type { Patient } from '@/types/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const status = searchParams.get('status') || undefined;

    const filters: any = {};
    if (limit) filters.limit = limit;
    if (offset !== undefined) filters.offset = offset;
    if (status) filters.status = status;

    const result = await getPatients(filters);

    // Return both data and count for pagination
    return NextResponse.json({
      data: result.data || [],
      count: result.count || 0
    });
  } catch (error) {
    console.error('Get patients error:', error);
    return NextResponse.json({ data: [], count: 0 });
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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status, benefit_period, level_of_care, rn_case_manager_id, residence_type } = body;

    if (!mrn || !first_name || !last_name) {
      return NextResponse.json({ error: 'Missing required fields: mrn, first_name, last_name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([{
        mrn,
        first_name,
        last_name,
        date_of_birth: date_of_birth || null,
        admission_date: admission_date || null,
        admitted_date: admission_date || null,  // Also set admitted_date for tracking
        diagnosis: diagnosis || null,
        status: status || 'active',
        benefit_period: benefit_period || 1,  // Default to BP1
        level_of_care: level_of_care || null,
        rn_case_manager_id: rn_case_manager_id || null,
        residence_type: residence_type || null,
      }])
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry for patient creation (not issue-specific)
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: null,
        user_id: user.id,
        action: 'patient_created',
        details: {
          patient_id: data.id,
          first_name,
          last_name,
          mrn,
          benefit_period: benefit_period || 1
        }
      });

    // Send notifications to all hospice users (fire and forget)
    const hospiceId = await getUserHospiceId(user.id);
    if (hospiceId) {
      notifyNewPatient(user.id, hospiceId, {
        id: data.id,
        first_name,
        last_name,
        mrn,
      }).catch((err) => console.error('Failed to send patient notification:', err));
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create patient error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Patient with this MRN already exists' }, { status: 409 });
    }
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
