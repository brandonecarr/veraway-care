import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the patient
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Verify the current user is the RN Case Manager for this patient
    if (patient.rn_case_manager_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized - not the assigned RN Case Manager' }, { status: 403 });
    }

    // Calculate new benefit period (max is 6)
    const currentPeriod = patient.benefit_period || 1;
    const newPeriod = Math.min(currentPeriod + 1, 6);

    // Reset the admission date to today for the new period
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('patients')
      .update({
        benefit_period: newPeriod,
        admitted_date: today,
        admission_date: today,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry for recertification
    await supabase
      .from('issue_audit_log')
      .insert({
        issue_id: null,
        user_id: user.id,
        action: 'patient_recertified',
        details: {
          patient_id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          mrn: data.mrn,
          previous_benefit_period: currentPeriod,
          new_benefit_period: newPeriod,
        }
      });

    return NextResponse.json({
      success: true,
      patient: data,
      previous_period: currentPeriod,
      new_period: newPeriod,
    });
  } catch (error) {
    console.error('Recertification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
