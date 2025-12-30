import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    // Check query params for role filter
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    const allStaff = searchParams.get('all') === 'true';

    console.log('Fetching users for facility:', currentUserData.facility_id);

    // Step 1: Get user_ids from the same facility (optionally filtered by role)
    let rolesQuery = serverSupabase
      .from('user_roles')
      .select('user_id')
      .eq('facility_id', currentUserData.facility_id);

    if (roleFilter) {
      rolesQuery = rolesQuery.eq('role', roleFilter);
    } else if (!allStaff) {
      // Default: only clinicians for backwards compatibility
      rolesQuery = rolesQuery.eq('role', 'clinician');
    }
    // If allStaff=true, don't filter by role

    const { data: userRoles, error: rolesError } = await rolesQuery;

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw rolesError;
    }

    console.log('Found user roles:', userRoles?.length || 0);

    if (!userRoles || userRoles.length === 0) {
      // Return in format expected by message center
      return NextResponse.json({ users: [] });
    }

    // Step 2: Get user details for these user_ids
    const userIds = userRoles.map(ur => ur.user_id);

    const { data: usersData, error: usersError } = await serverSupabase
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Format the response
    const users = (usersData || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email?.split('@')[0],
      avatar_url: u.avatar_url
    }));

    // Return in format expected by message center
    return NextResponse.json({ users });
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
