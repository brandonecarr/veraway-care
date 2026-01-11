import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('handoffs')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update handoff error:', error);
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update handoff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
