import { NextResponse } from 'next/server';
import { createClient } from '../../../../../supabase/server';
import { searchPatients } from '@/lib/care-coordination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patients = await searchPatients(q);
    return NextResponse.json(patients);
  } catch (error) {
    console.error('Search patients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
