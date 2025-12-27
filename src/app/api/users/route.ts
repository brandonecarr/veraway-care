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
    const { data: currentUserData, error: userDataError } = await serverSupabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      console.error('Error fetching current user data:', userDataError);
      throw userDataError;
    }

    if (!currentUserData?.facility_id) {
      console.log('User has no facility_id:', user.id);
      return NextResponse.json({ error: 'User not associated with a facility' }, { status: 400 });
    }

    console.log('Fetching clinicians for facility:', currentUserData.facility_id);

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

    console.log('Found clinician roles:', userRoles?.length || 0);

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
  } catch (error: any) {
    console.error('Get users error:', error);
    // Return detailed error in development to help debug
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
