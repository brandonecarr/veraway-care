import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { getBenefitPeriodDays } from '@/types/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get patients assigned to this RN Case Manager
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('rn_case_manager_id', user.id)
      .eq('status', 'active')
      .not('admitted_date', 'is', null);

    if (error) throw error;

    if (!patients || patients.length === 0) {
      return NextResponse.json({ patients: [], count: 0 });
    }

    // Calculate days remaining and filter patients with ≤7 days
    const now = new Date();
    const patientsNeedingRecert = patients
      .map(patient => {
        const admittedDate = new Date(patient.admitted_date);
        const benefitPeriod = patient.benefit_period || 1;
        const periodDays = getBenefitPeriodDays(benefitPeriod);
        const endDate = new Date(admittedDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        return {
          ...patient,
          days_remaining: Math.max(0, daysRemaining),
          period_days: periodDays,
        };
      })
      .filter(patient => patient.days_remaining <= 7)
      .sort((a, b) => a.days_remaining - b.days_remaining); // Sort by urgency

    return NextResponse.json({
      patients: patientsNeedingRecert,
      count: patientsNeedingRecert.length,
    });
  } catch (error) {
    console.error('Get recertification patients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
