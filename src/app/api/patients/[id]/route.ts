import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { notifyPatientUpdate, getUserFacilityId } from '@/lib/notifications';

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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status, benefit_period } = body;

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

    // Send notifications to all facility users (fire and forget)
    const facilityId = await getUserFacilityId(user.id);
    if (facilityId) {
      const changedFields = Object.keys(updateData).join(', ');
      notifyPatientUpdate(user.id, facilityId, {
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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status, benefit_period } = body;

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

    // Send notifications to all facility users (fire and forget)
    const facilityId = await getUserFacilityId(user.id);
    if (facilityId) {
      const changedFields = Object.keys(updateData).join(', ');
      notifyPatientUpdate(user.id, facilityId, {
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
