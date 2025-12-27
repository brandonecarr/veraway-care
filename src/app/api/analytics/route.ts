import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
      });

    // 2. Resolution Velocity
    const { data: resolutionVelocity } = await supabase
      .rpc('get_resolution_velocity', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

    // 3. Clinician Workload
    const { data: clinicianWorkload } = await supabase
      .rpc('get_clinician_workload');

    // 4. Issue Type Distribution Over Time
    const { data: issueTypeDistribution } = await supabase
      .rpc('get_issue_type_distribution', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

    // Transform snake_case to camelCase for frontend compatibility
    const transformedResponseTimeTrends = (responseTimeTrends || []).map((item: any) => ({
      date: item.date,
      avgResponseTime: item.avg_response_time,
      count: item.count,
    }));

    const transformedResolutionVelocity = (resolutionVelocity || []).map((item: any) => ({
      date: item.date,
      resolved: item.resolved,
      avgHours: item.avg_hours,
    }));

    const transformedClinicianWorkload = (clinicianWorkload || []).map((item: any) => ({
      userId: item.user_id,
      name: item.name,
      email: item.email,
      assignedCount: item.assigned_count,
      resolvedCount: item.resolved_count,
      overdueCount: item.overdue_count,
      avgCompletionTime: item.avg_completion_time,
    }));

    const transformedIssueTypeDistribution = (issueTypeDistribution || []).map((item: any) => ({
      date: item.date,
      distribution: item.distribution, // Already in correct format
    }));

    return NextResponse.json({
      responseTimeTrends: transformedResponseTimeTrends,
      resolutionVelocity: transformedResolutionVelocity,
      clinicianWorkload: transformedClinicianWorkload,
      issueTypeDistribution: transformedIssueTypeDistribution,
    });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
