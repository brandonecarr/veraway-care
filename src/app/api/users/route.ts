import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // First check if user is authenticated
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's facility_id
    const { data: currentUserData } = await serverSupabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (!currentUserData?.facility_id) {
      return NextResponse.json({ error: 'User not associated with a facility' }, { status: 400 });
    }

    // Get all clinicians from the same facility
    const { data: clinicians, error } = await serverSupabase
      .from('users')
      .select(`
        id,
        email,
        name,
        user_roles!inner(role)
      `)
      .eq('facility_id', currentUserData.facility_id)
      .eq('user_roles.role', 'clinician');

    if (error) {
      throw error;
    }

    // Format the response
    const users = (clinicians || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email?.split('@')[0]
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
