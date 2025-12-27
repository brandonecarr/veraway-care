import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facility_id, email } = body;

    if (!facility_id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: facility_id, email' },
        { status: 400 }
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

    // Get the user by email
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = authUser.id;

    // Delete from user_roles table
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('facility_id', facility_id)
      .eq('role', 'coordinator');

    if (deleteRoleError) {
      console.error('Delete user role error:', deleteRoleError);
      return NextResponse.json(
        { error: 'Failed to remove coordinator role' },
        { status: 500 }
      );
    }

    // Delete from public.users table
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('Delete public user error:', deleteUserError);
      return NextResponse.json(
        { error: 'Failed to delete user record' },
        { status: 500 }
      );
    }

    // Delete from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Delete auth user error:', deleteAuthError);
      return NextResponse.json(
        { error: 'Failed to delete user from authentication' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Coordinator removed successfully',
    });
  } catch (error: any) {
    console.error('Delete coordinator error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
