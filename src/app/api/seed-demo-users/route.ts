import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DEMO_USERS = [
  { email: 'clinician@demo.com', password: 'demo123456', role: 'clinician' },
  { email: 'coordinator@demo.com', password: 'demo123456', role: 'coordinator' },
  { email: 'afterhours@demo.com', password: 'demo123456', role: 'after_hours' },
];

export async function POST() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const results = [];

    for (const user of DEMO_USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        results.push({ email: user.email, status: 'exists', userId });
      } else {
        // Create the user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        });

        if (createError) {
          results.push({ email: user.email, status: 'error', error: createError.message });
          continue;
        }

        userId = newUser.user.id;
        results.push({ email: user.email, status: 'created', userId });
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role: user.role }, { onConflict: 'user_id' });

      if (roleError) {
        results.push({ email: user.email, roleStatus: 'error', error: roleError.message });
      } else {
        results.push({ email: user.email, roleStatus: 'assigned', role: user.role });
      }
    }

    // Add sample issues for the coordinator
    const coordinatorResult = results.find(r => r.email === 'coordinator@demo.com' && r.userId);
    if (coordinatorResult?.userId) {
      const { error: issuesError } = await supabaseAdmin.from('issues').insert([
        {
          patient_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          reported_by: coordinatorResult.userId,
          assigned_to: coordinatorResult.userId,
          issue_type: 'Med Discrepancies',
          description: 'Patient needs pain medication refill',
          status: 'open',
          priority: 'high',
          tags: ['urgent', 'pain-management']
        },
        {
          patient_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          reported_by: coordinatorResult.userId,
          assigned_to: null,
          issue_type: 'Concern/Complaint',
          description: 'Family requesting care meeting',
          status: 'open',
          priority: 'normal',
          tags: ['family']
        },
        {
          patient_id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
          reported_by: coordinatorResult.userId,
          assigned_to: coordinatorResult.userId,
          issue_type: 'DME Malfunction',
          description: 'Hospital bed delivery scheduled for tomorrow',
          status: 'in_progress',
          priority: 'normal',
          tags: ['equipment', 'delivery']
        },
        {
          patient_id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
          reported_by: coordinatorResult.userId,
          assigned_to: coordinatorResult.userId,
          issue_type: 'Unmanaged Pain',
          description: 'Breakthrough pain reported by family',
          status: 'open',
          priority: 'urgent',
          tags: ['urgent', 'pain']
        },
        {
          patient_id: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
          reported_by: coordinatorResult.userId,
          assigned_to: coordinatorResult.userId,
          issue_type: 'Not Following Plan-of-Care',
          description: 'Care plan review needed',
          status: 'open',
          priority: 'normal',
          tags: ['documentation']
        }
      ]);

      if (issuesError) {
        results.push({ issues: 'error', error: issuesError.message });
      } else {
        results.push({ issues: 'created', count: 5 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      results,
      credentials: DEMO_USERS.map(u => ({ email: u.email, password: u.password, role: u.role }))
    });
  } catch (error: any) {
    console.error('Seed demo users error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
