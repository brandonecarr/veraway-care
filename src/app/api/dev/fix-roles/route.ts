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

export async function GET() {
  try {
    const supabase = getAdminClient();

    // Fetch all user_roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (rolesError) {
      console.error('Get roles error:', rolesError);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name');

    if (usersError) {
      console.error('Get users error:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Create a map of users by ID
    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Format the response
    // Note: user_roles table still uses facility_id until migration renames it
    const formattedRoles = roles?.map(role => {
      const user = userMap.get(role.user_id);
      return {
        id: role.id,
        user_id: role.user_id,
        email: user?.email || 'Unknown',
        name: user?.name || 'Unknown',
        role: role.role,
        hospice_id: role.facility_id,
        // Backwards compatibility
        facility_id: role.facility_id,
        created_at: role.created_at,
      };
    });

    return NextResponse.json({
      roles: formattedRoles,
      total: formattedRoles?.length || 0,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id_to_change } = body;

    if (!user_id_to_change) {
      return NextResponse.json(
        { error: 'Missing user_id_to_change parameter' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Update the role to clinician
    const { data, error } = await supabase
      .from('user_roles')
      .update({ role: 'clinician' })
      .eq('user_id', user_id_to_change)
      .select();

    if (error) {
      console.error('Update role error:', error);
      return NextResponse.json(
        { error: 'Failed to update role: ' + error.message },
        { status: 500 }
      );
    }

    // Fetch user details separately
    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', user_id_to_change)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Role updated to clinician',
      updated: {
        ...data?.[0],
        user,
      },
    });
  } catch (error: any) {
    console.error('Update role error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
