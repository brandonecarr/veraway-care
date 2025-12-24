import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import { getDashboardMetrics } from '@/lib/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Get metrics error:', error);
    // Return default metrics on error
    return NextResponse.json({
      openIssues: 0,
      overdueCount: 0,
      avgResolutionTime: 0,
      issuesByType: {},
      issuesResolvedToday: 0
    });
  }
}
