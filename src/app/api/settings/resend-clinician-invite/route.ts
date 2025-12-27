import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated and is a coordinator
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { facility_id, email } = body;

    if (!facility_id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: facility_id, email' },
        { status: 400 }
      );
    }

    // Verify the user is a coordinator for this facility
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.facility_id !== facility_id) {
      return NextResponse.json(
        { error: 'You do not have permission to resend invites for this facility' },
        { status: 403 }
      );
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('facility_id', facility_id)
      .single();

    if (roleData?.role !== 'coordinator') {
      return NextResponse.json(
        { error: 'Only coordinators can resend invites' },
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

    // Check if user exists and get their registration status
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has already registered (signed in at least once)
    if (authUser.last_sign_in_at) {
      return NextResponse.json(
        { error: 'User has already accepted the invitation' },
        { status: 400 }
      );
    }

    // Resend the invite
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
      : 'https://www.verawaycare.com/invite';

    console.log('📧 Resending invite to clinician:', email);
    console.log('📧 Redirect URL:', redirectUrl);

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
    });

    if (inviteError) {
      console.error('❌ Failed to resend invite:', inviteError);
      console.error('❌ Error details:', JSON.stringify(inviteError, null, 2));
      return NextResponse.json(
        { error: inviteError.message || 'Failed to resend invite' },
        { status: 500 }
      );
    }

    console.log('✅ Invite resent successfully to:', email);

    return NextResponse.json({
      success: true,
      message: 'Invite resent successfully',
    });
  } catch (error: any) {
    console.error('Resend clinician invite error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
