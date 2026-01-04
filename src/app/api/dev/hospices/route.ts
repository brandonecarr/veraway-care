import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Use service role key for admin operations
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

    // Fetch all hospices
    const { data: hospices, error } = await supabase
      .from('hospices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch coordinator roles
    // Note: user_roles table still uses facility_id until migration renames it
    const { data: coordinatorRoles } = await supabase
      .from('user_roles')
      .select('facility_id, user_id')
      .eq('role', 'coordinator');

    // Get all coordinator user IDs
    const coordinatorUserIds = coordinatorRoles?.map(c => c.user_id) || [];

    // Fetch user data from public.users table for all coordinators
    const usersMap = new Map<string, { email: string; name: string }>();
    if (coordinatorUserIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', coordinatorUserIds);

      usersData?.forEach(user => {
        usersMap.set(user.id, { email: user.email, name: user.name });
      });
    }

    // Get auth users to check registration status
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = authData?.users || [];

    // Map coordinator data to hospices
    const coordinatorMap = new Map<string, {
      count: number;
      all_registered: boolean;
      coordinator_name: string | null;
      coordinator_email: string | null;
    }>();

    console.log('Processing coordinator roles:', coordinatorRoles?.length || 0);
    console.log('Users map size:', usersMap.size);

    coordinatorRoles?.forEach(coord => {
      const hospiceId = coord.facility_id;
      const userInfo = usersMap.get(coord.user_id);

      console.log(`Processing coordinator: user_id=${coord.user_id}, hospice_id=${hospiceId}, userInfo=`, userInfo);

      if (!coordinatorMap.has(hospiceId)) {
        coordinatorMap.set(hospiceId, {
          count: 0,
          all_registered: true,
          coordinator_name: userInfo?.name || null,
          coordinator_email: userInfo?.email || null,
        });
      } else if (userInfo) {
        // If we already have an entry but this coordinator has user info, update it
        const existing = coordinatorMap.get(hospiceId)!;
        if (!existing.coordinator_name && userInfo.name) {
          existing.coordinator_name = userInfo.name;
        }
        if (!existing.coordinator_email && userInfo.email) {
          existing.coordinator_email = userInfo.email;
        }
      }

      const hospiceData = coordinatorMap.get(hospiceId)!;
      hospiceData.count++;

      // Check if this coordinator has completed registration
      // Must have logged in at least once (which means they've set a password)
      const authUser = authUsers.find(u => u.email === userInfo?.email);
      if (!authUser || !authUser.last_sign_in_at) {
        hospiceData.all_registered = false;
      }
    });

    console.log('Coordinator map:', Object.fromEntries(coordinatorMap));

    const hospicesWithCoordinators = hospices?.map(hospice => ({
      ...hospice,
      coordinator_count: coordinatorMap.get(hospice.id)?.count || 0,
      coordinators_registered: coordinatorMap.get(hospice.id)?.all_registered || false,
      coordinator_name: coordinatorMap.get(hospice.id)?.coordinator_name || null,
      coordinator_email: coordinatorMap.get(hospice.id)?.coordinator_email || null,
    }));

    return NextResponse.json(hospicesWithCoordinators || []);
  } catch (error) {
    console.error('Get hospices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const {
      name,
      slug,
      subscription_tier,
      max_users,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      email
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('hospices')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A hospice with this slug already exists' },
        { status: 409 }
      );
    }

    // Create hospice
    const { data, error } = await supabase
      .from('hospices')
      .insert([
        {
          name,
          slug,
          subscription_tier: subscription_tier || 'free',
          max_users: max_users || 10,
          is_active: true,
          address_line1: address_line1 || null,
          address_line2: address_line2 || null,
          city: city || null,
          state: state || null,
          zip_code: zip_code || null,
          phone: phone || null,
          email: email || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create hospice error:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Hospice with this slug already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
