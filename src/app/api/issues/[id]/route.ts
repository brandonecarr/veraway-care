import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { updateIssue } from '@/lib/care-coordination';

export const dynamic = 'force-dynamic';

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
    const issue = await updateIssue(params.id, body);

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
