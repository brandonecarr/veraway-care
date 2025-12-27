import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facility_id } = body;

    if (!facility_id) {
      return NextResponse.json(
        { error: 'Missing required field: facility_id' },
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

    // Get all coordinators for this facility
    const { data: coordinatorRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('facility_id', facility_id)
      .eq('role', 'coordinator');

    if (rolesError) {
      console.error('Get coordinator roles error:', rolesError);
      return NextResponse.json(
        { error: 'Failed to find coordinators' },
        { status: 500 }
      );
    }

    if (!coordinatorRoles || coordinatorRoles.length === 0) {
      return NextResponse.json(
        { error: 'No coordinators found for this facility' },
        { status: 404 }
      );
    }

    // Get user details for all coordinators
    const userIds = coordinatorRoles.map(r => r.user_id);
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', userIds);

    if (usersError || !users || users.length === 0) {
      console.error('Get users error:', usersError);
      return NextResponse.json(
        { error: 'Failed to find coordinator users' },
        { status: 500 }
      );
    }

    // Resend invites to all coordinators
    const results = await Promise.all(
      users.map(async (user) => {
        try {
          // First, check if user has already registered (actually signed in with password)
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = authUsers.users.find(u => u.email === user.email);

          if (authUser && authUser.last_sign_in_at) {
            // User already registered (completed onboarding), skip invite
            return {
              email: user.email,
              success: false,
              error: 'User already registered',
              skipped: true
            };
          }

          // Resend the invite - this will expire old tokens and generate new ones
          const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL}/invite`
            : 'https://www.verawaycare.com/invite';

          const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            user.email,
            {
              redirectTo: redirectUrl,
            }
          );

          if (inviteError) {
            console.error(`Failed to resend invite to ${user.email}:`, inviteError);
            return { email: user.email, success: false, error: inviteError.message };
          }

          return { email: user.email, success: true };
        } catch (error: any) {
          console.error(`Error resending invite to ${user.email}:`, error);
          return { email: user.email, success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedEmails = results.filter(r => !r.success && !r.skipped).map(r => r.email);
    const skippedEmails = results.filter(r => r.skipped).map(r => r.email);

    // Build response message
    let message = '';
    if (successCount > 0) {
      message = `Successfully resent ${successCount} invite(s)`;
    }
    if (skippedCount > 0) {
      message += (message ? '. ' : '') + `${skippedCount} user(s) already registered`;
    }
    if (failedEmails.length > 0) {
      message += (message ? '. ' : '') + `${failedEmails.length} invite(s) failed`;
    }

    return NextResponse.json({
      success: true,
      message: message || 'No invites sent',
      resent_count: successCount,
      skipped_count: skippedCount,
      failed_emails: failedEmails.length > 0 ? failedEmails : undefined,
      skipped_emails: skippedEmails.length > 0 ? skippedEmails : undefined,
    });
  } catch (error: any) {
    console.error('Resend invites error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
