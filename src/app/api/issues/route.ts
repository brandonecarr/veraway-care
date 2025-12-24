import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';
import { createIssue, getIssues } from '@/lib/care-coordination';

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

    const filters: any = { includeResolved };
    if (patient_id) {
      filters.patient_id = patient_id;
    }
    if (status) {
      filters.status = status;
    }

    const issues = await getIssues(filters);
    return NextResponse.json(issues || []);
  } catch (error) {
    console.error('Get issues error:', error);
    // Return empty array on error so dashboard still renders
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
    const issue = await createIssue({
      ...body,
      reported_by: user.id
    });

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Create issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
