import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's facility and verify they're a coordinator
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.facility_id) {
      return NextResponse.json(
        { error: 'User not found or not associated with a facility' },
        { status: 404 }
      );
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('facility_id', userData.facility_id)
      .single();

    if (roleData?.role !== 'coordinator') {
      return NextResponse.json(
        { error: 'Only coordinators can view staff members' },
        { status: 403 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all users in the facility
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email, created_at')
      .eq('facility_id', userData.facility_id);

    if (!users) {
      return NextResponse.json([]);
    }

    // Get auth users to check registration status
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    // Get roles for all users
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, job_role')
      .eq('facility_id', userData.facility_id);

    const staffWithStatus = users
      .map(u => {
        const authUser = authUsers.find(au => au.id === u.id);
        const userRole = roles?.find(r => r.user_id === u.id);

        return {
          ...u,
          // Use last_sign_in_at to determine if user has completed onboarding
          // Only users who have logged in (set password and completed onboarding) are considered registered
          has_completed_onboarding: !!authUser?.last_sign_in_at,
          role: userRole?.role || 'clinician',
          job_role: userRole?.job_role,
        };
      })
      // Filter out coordinators - only show clinicians in the team members list
      .filter(staff => staff.role === 'clinician');

    return NextResponse.json(staffWithStatus);
  } catch (error: any) {
    console.error('Get staff error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
