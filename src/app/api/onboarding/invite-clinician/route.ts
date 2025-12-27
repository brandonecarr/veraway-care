import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { facility_id, name, email, job_role } = body;

    if (!facility_id || !name || !email || !job_role) {
      return NextResponse.json(
        { error: 'Missing required fields: facility_id, name, email, job_role' },
        { status: 400 }
      );
    }

    // Verify the user belongs to this facility
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.facility_id !== facility_id) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users to this facility' },
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
        console.log('User already registered, adding to facility as clinician');
      } else {
        console.log('User exists but not registered, will resend invite');
      }
    } else {
      // Create new user account and send invite
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
        : 'https://www.verawaycare.com/invite';

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            name,
            full_name: name,
            job_role,
          },
          redirectTo: redirectUrl,
        }
      );

      if (authError) {
        console.error('Auth error:', authError);
        return NextResponse.json(
          { error: authError.message || 'Failed to invite clinician' },
          { status: 400 }
        );
      }

      if (!authData.user) {
        return NextResponse.json({ error: 'Failed to invite clinician' }, { status: 500 });
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
      // Update user's facility if needed
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

    // Set user role as clinician (delete existing first, then insert)
    // First, delete any existing role for this user in this facility
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('facility_id', facility_id);

    // Now insert the clinician role with job_role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'clinician',
        facility_id,
        job_role,
      })
      .select();

    if (roleError) {
      console.error('Set role error:', roleError);
      return NextResponse.json(
        { error: 'Failed to set user role: ' + roleError.message },
        { status: 500 }
      );
    }

    console.log('Clinician role set successfully:', roleData);

    // If user existed but hasn't registered yet, resend the invite
    if (userExists && !userAlreadyRegistered) {
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
        : 'https://www.verawaycare.com/invite';

      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
      });
      if (resendError) {
        console.error('Resend invite error:', resendError);
        return NextResponse.json(
          { error: 'Failed to resend invite: ' + resendError.message },
          { status: 500 }
        );
      }
    }

    let message = 'Clinician invited successfully';
    if (userAlreadyRegistered) {
      message = 'Clinician added to facility successfully';
    } else if (userExists) {
      message = 'Invite resent successfully';
    }

    return NextResponse.json({
      success: true,
      message,
      user_id: userId,
    });
  } catch (error: any) {
    console.error('Invite clinician error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
