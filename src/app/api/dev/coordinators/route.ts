import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const facility_id = searchParams.get('facility_id');

    if (!facility_id) {
      return NextResponse.json(
        { error: 'Missing facility_id parameter' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Fetch coordinator roles for this facility
    const { data: coordinators, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('facility_id', facility_id)
      .eq('role', 'coordinator');

    if (error) {
      console.error('Get coordinators error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch coordinators' },
        { status: 500 }
      );
    }

    if (!coordinators || coordinators.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch user details
    const userIds = coordinators.map(c => c.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, created_at')
      .in('id', userIds);

    if (usersError) {
      console.error('Get users error:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch user details' },
        { status: 500 }
      );
    }

    return NextResponse.json(users || []);
  } catch (error) {
    console.error('Get coordinators error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
