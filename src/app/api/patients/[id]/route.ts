import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { notifyPatientUpdate, getUserHospiceId } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// Helper to format field names for notifications
function formatFieldNames(fields: string[]): string {
  const fieldLabels: Record<string, string> = {
    mrn: 'MRN',
    first_name: 'first name',
    last_name: 'last name',
    date_of_birth: 'date of birth',
    admission_date: 'admission date',
    admitted_date: 'admission date',
    diagnosis: 'diagnosis',
    status: 'status',
    benefit_period: 'benefit period',
    level_of_care: 'level of care',
    rn_case_manager_id: 'case manager',
    residence_type: 'residence type',
    discharge_date: 'discharge date',
    death_date: 'death date',
    discharge_reason: 'discharge reason',
    cause_of_death: 'cause of death',
    bereavement_status: 'bereavement status',
  };

  // Filter out duplicate fields (admitted_date/admission_date are the same)
  const uniqueFields = fields.filter(f => f !== 'admitted_date' || !fields.includes('admission_date'));

  const formatted = uniqueFields.map(f => fieldLabels[f] || f.replace(/_/g, ' '));

  if (formatted.length === 0) return '';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;

  return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

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

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get patient error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status, benefit_period, level_of_care, rn_case_manager_id, residence_type, discharge_date, death_date, discharge_reason, cause_of_death, bereavement_status } = body;

    const updateData: any = {};
    if (mrn !== undefined) updateData.mrn = mrn;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (admission_date !== undefined) {
      updateData.admission_date = admission_date;
      updateData.admitted_date = admission_date;  // Also update admitted_date for tracking
    }
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (status !== undefined) updateData.status = status;
    if (benefit_period !== undefined) updateData.benefit_period = benefit_period;
    if (level_of_care !== undefined) updateData.level_of_care = level_of_care;
    if (rn_case_manager_id !== undefined) updateData.rn_case_manager_id = rn_case_manager_id || null;
    if (residence_type !== undefined) updateData.residence_type = residence_type;
    if (discharge_date !== undefined) updateData.discharge_date = discharge_date;
    if (death_date !== undefined) updateData.death_date = death_date;
    if (discharge_reason !== undefined) updateData.discharge_reason = discharge_reason;
    if (cause_of_death !== undefined) updateData.cause_of_death = cause_of_death;
    if (bereavement_status !== undefined) updateData.bereavement_status = bereavement_status;

    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Send notifications to all hospice users (fire and forget)
    const hospiceId = await getUserHospiceId(user.id);
    if (hospiceId) {
      const changedFields = formatFieldNames(Object.keys(updateData));
      notifyPatientUpdate(user.id, hospiceId, {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        mrn: data.mrn,
      }, changedFields).catch((err) => console.error('Failed to send patient update notification:', err));
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Update patient error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Patient with this MRN already exists' }, { status: 409 });
    }
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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status, benefit_period, level_of_care, rn_case_manager_id, residence_type, discharge_date, death_date, discharge_reason, cause_of_death, bereavement_status } = body;

    const updateData: any = {};
    if (mrn !== undefined) updateData.mrn = mrn;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (admission_date !== undefined) {
      updateData.admission_date = admission_date;
      updateData.admitted_date = admission_date;  // Also update admitted_date for tracking
    }
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (status !== undefined) updateData.status = status;
    if (benefit_period !== undefined) updateData.benefit_period = benefit_period;
    if (level_of_care !== undefined) updateData.level_of_care = level_of_care;
    if (rn_case_manager_id !== undefined) updateData.rn_case_manager_id = rn_case_manager_id || null;
    if (residence_type !== undefined) updateData.residence_type = residence_type;
    if (discharge_date !== undefined) updateData.discharge_date = discharge_date;
    if (death_date !== undefined) updateData.death_date = death_date;
    if (discharge_reason !== undefined) updateData.discharge_reason = discharge_reason;
    if (cause_of_death !== undefined) updateData.cause_of_death = cause_of_death;
    if (bereavement_status !== undefined) updateData.bereavement_status = bereavement_status;

    const { data, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Send notifications to all hospice users (fire and forget)
    const hospiceId = await getUserHospiceId(user.id);
    if (hospiceId) {
      const changedFields = formatFieldNames(Object.keys(updateData));
      notifyPatientUpdate(user.id, hospiceId, {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        mrn: data.mrn,
      }, changedFields).catch((err) => console.error('Failed to send patient update notification:', err));
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Update patient error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Patient with this MRN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete patient error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
