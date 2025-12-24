import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const daysBack = parseInt(period);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // 1. Response Time Trends
    const { data: responseTimeTrends } = await supabase
      .rpc('get_response_time_trends', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .select('*');

    // 2. Resolution Velocity
    const { data: resolutionVelocity } = await supabase
      .rpc('get_resolution_velocity', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .select('*');

    // 3. Clinician Workload
    const { data: clinicianWorkload } = await supabase
      .rpc('get_clinician_workload')
      .select('*');

    // 4. Issue Type Distribution Over Time
    const { data: issueTypeDistribution } = await supabase
      .rpc('get_issue_type_distribution', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .select('*');

    return NextResponse.json({
      responseTimeTrends: responseTimeTrends || [],
      resolutionVelocity: resolutionVelocity || [],
      clinicianWorkload: clinicianWorkload || [],
      issueTypeDistribution: issueTypeDistribution || [],
    });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
