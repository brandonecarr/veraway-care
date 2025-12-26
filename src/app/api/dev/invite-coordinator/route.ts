import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, facility_id } = body;

    if (!email || !name || !facility_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, facility_id' },
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

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === email);

    let userId: string;
    let userAlreadyRegistered = false;

    if (userExists) {
      // User already exists
      userId = userExists.id;
      userAlreadyRegistered = !!userExists.email_confirmed_at;

      if (userAlreadyRegistered) {
        console.log('User already registered, adding to facility');
      } else {
        console.log('User exists but not registered, will resend invite');
      }
    } else {
      // Create new user account and send invite
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            name,
            full_name: name,
          },
        }
      );

      if (authError) {
        console.error('Auth error:', authError);
        return NextResponse.json(
          { error: authError.message || 'Failed to invite user' },
          { status: 400 }
        );
      }

      if (!authData.user) {
        return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });
      }

      userId = authData.user.id;
    }

    // Ensure user exists in public.users table
    const { data: existingPublicUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingPublicUser) {
      // Create user in public.users table
      const { error: createUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email,
          name,
          facility_id,
        });

      if (createUserError) {
        console.error('Create public user error:', createUserError);
        return NextResponse.json(
          { error: 'Failed to create user record' },
          { status: 500 }
        );
      }
    } else {
      // Update user's facility
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ facility_id })
        .eq('id', userId);

      if (updateError) {
        console.error('Update user facility error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user facility' },
          { status: 500 }
        );
      }
    }

    // Set user role as coordinator (delete existing first, then insert)
    // First, delete any existing role for this user in this facility
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('facility_id', facility_id);

    // Now insert the coordinator role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'coordinator',
        facility_id,
      })
      .select();

    if (roleError) {
      console.error('Set role error:', roleError);
      return NextResponse.json(
        { error: 'Failed to set user role: ' + roleError.message },
        { status: 500 }
      );
    }

    console.log('Role set successfully:', roleData);

    // If user existed but hasn't registered yet, resend the invite
    if (userExists && !userAlreadyRegistered) {
      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (resendError) {
        console.error('Resend invite error:', resendError);
        return NextResponse.json(
          { error: 'Failed to resend invite: ' + resendError.message },
          { status: 500 }
        );
      }
    }

    let message = 'Coordinator invited successfully';
    if (userAlreadyRegistered) {
      message = 'Coordinator added to facility successfully';
    } else if (userExists) {
      message = 'Invite resent successfully';
    }

    return NextResponse.json({
      success: true,
      message,
      user_id: userId,
    });
  } catch (error: any) {
    console.error('Invite coordinator error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
