import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facility_id, old_email, new_email, new_name } = body;

    if (!facility_id || !old_email || !new_email || !new_name) {
      return NextResponse.json(
        { error: 'Missing required fields: facility_id, old_email, new_email, new_name' },
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

    // Get the existing user by old email
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(u => u.email === old_email);

    if (!existingAuthUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = existingAuthUser.id;

    // Update auth user email if it changed
    if (old_email !== new_email) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email: new_email }
      );

      if (updateAuthError) {
        console.error('Update auth user error:', updateAuthError);
        return NextResponse.json(
          { error: 'Failed to update user email in authentication' },
          { status: 500 }
        );
      }
    }

    // Update public.users table
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        email: new_email,
        name: new_name,
      })
      .eq('id', userId);

    if (updateUserError) {
      console.error('Update public user error:', updateUserError);
      return NextResponse.json(
        { error: 'Failed to update user information' },
        { status: 500 }
      );
    }

    // Resend invite with new email
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
      : 'https://www.verawaycare.com/invite';

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      new_email,
      {
        redirectTo: redirectUrl,
      }
    );

    if (inviteError) {
      console.error('Resend invite error:', inviteError);
      // Don't fail the whole operation if invite fails
      console.warn('Coordinator info updated but invite email failed to send');
    }

    return NextResponse.json({
      success: true,
      message: 'Coordinator information updated successfully',
    });
  } catch (error: any) {
    console.error('Update coordinator error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
