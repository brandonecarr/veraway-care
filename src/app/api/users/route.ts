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

    // Step 1: Get all clinician user_ids from the same facility
    const { data: userRoles, error: rolesError } = await serverSupabase
      .from('user_roles')
      .select('user_id')
      .eq('facility_id', currentUserData.facility_id)
      .eq('role', 'clinician');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw rolesError;
    }

    if (!userRoles || userRoles.length === 0) {
      // No clinicians found in this facility
      return NextResponse.json([]);
    }

    // Step 2: Get user details for these clinician user_ids
    const clinicianIds = userRoles.map(ur => ur.user_id);

    const { data: clinicians, error: usersError } = await serverSupabase
      .from('users')
      .select('id, email, name')
      .in('id', clinicianIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
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
