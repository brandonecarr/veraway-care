import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import type { Patient } from '@/types/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Get patients error:', error);
    return NextResponse.json([]);
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
    const { mrn, first_name, last_name, date_of_birth, admission_date, diagnosis, status } = body;

    if (!mrn || !first_name || !last_name) {
      return NextResponse.json({ error: 'Missing required fields: mrn, first_name, last_name' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([{
        mrn,
        first_name,
        last_name,
        date_of_birth,
        admission_date,
        diagnosis,
        status: status || 'active'
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
          mrn
        }
      });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create patient error:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Patient with this MRN already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
