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
    // Support both hospice_id and facility_id for backwards compatibility
    const hospiceId = body.hospice_id || body.facility_id;
    const { name, email, job_role } = body;

    if (!hospiceId || !name || !email || !job_role) {
      return NextResponse.json(
        { error: 'Missing required fields: hospice_id, name, email, job_role' },
        { status: 400 }
      );
    }

    // Verify the user belongs to this hospice
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('hospice_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.hospice_id !== hospiceId) {
      return NextResponse.json(
        { error: 'You do not have permission to invite users to this hospice' },
        { status: 403 }
      );
    }

    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      console.error('❌ SUPABASE_SERVICE_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log('📧 Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('📧 Service key exists:', !!process.env.SUPABASE_SERVICE_KEY);

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
      // Only consider user registered if they've actually signed in (set a password)
      userAlreadyRegistered = !!userExists.last_sign_in_at;

      if (userAlreadyRegistered) {
        console.log('User already registered, adding to hospice as clinician');
      } else {
        console.log('User exists but not registered, will resend invite');
      }
    } else {
      // Create new user account and send invite
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
        : 'https://www.verawaycare.com/invite';

      console.log('📧 Sending invite email to:', email);
      console.log('📧 Redirect URL:', redirectUrl);
      console.log('📧 User metadata:', { name, job_role });

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
        console.error('❌ Failed to send invite email:', authError);
        console.error('❌ Error details:', JSON.stringify(authError, null, 2));
        return NextResponse.json(
          { error: authError.message || 'Failed to invite clinician' },
          { status: 400 }
        );
      }

      if (!authData.user) {
        console.error('❌ No user data returned after invite');
        return NextResponse.json({ error: 'Failed to invite clinician' }, { status: 500 });
      }

      console.log('✅ Invite email sent successfully to:', email);
      console.log('✅ User ID:', authData.user.id);
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
          hospice_id: hospiceId,
        });

      if (createUserError) {
        console.error('Create public user error:', createUserError);
        return NextResponse.json(
          { error: 'Failed to create user record' },
          { status: 500 }
        );
      }
    } else {
      // Update user's hospice if needed
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ hospice_id: hospiceId })
        .eq('id', userId);

      if (updateError) {
        console.error('Update user hospice error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user hospice' },
          { status: 500 }
        );
      }
    }

    // Set user role as clinician (delete existing first, then insert)
    // First, delete any existing role for this user in this hospice
    // Note: user_roles table still uses facility_id until migration renames it
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('facility_id', hospiceId);

    // Now insert the clinician role with job_role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'clinician',
        facility_id: hospiceId,
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

      console.log('📧 Resending invite email to:', email);
      console.log('📧 Redirect URL:', redirectUrl);

      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
      });
      if (resendError) {
        console.error('❌ Failed to resend invite email:', resendError);
        console.error('❌ Error details:', JSON.stringify(resendError, null, 2));
        return NextResponse.json(
          { error: 'Failed to resend invite: ' + resendError.message },
          { status: 500 }
        );
      }
      console.log('✅ Invite email resent successfully to:', email);
    }

    let message = 'Clinician invited successfully';
    if (userAlreadyRegistered) {
      message = 'Clinician added to hospice successfully';
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
