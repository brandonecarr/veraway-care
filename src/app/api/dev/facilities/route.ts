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

    // Fetch all facilities
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch coordinator roles
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

    // Map coordinator data to facilities
    const coordinatorMap = new Map<string, {
      count: number;
      all_registered: boolean;
      coordinator_name: string | null;
      coordinator_email: string | null;
    }>();

    console.log('Processing coordinator roles:', coordinatorRoles?.length || 0);
    console.log('Users map size:', usersMap.size);

    coordinatorRoles?.forEach(coord => {
      const facilityId = coord.facility_id;
      const userInfo = usersMap.get(coord.user_id);

      console.log(`Processing coordinator: user_id=${coord.user_id}, facility_id=${facilityId}, userInfo=`, userInfo);

      if (!coordinatorMap.has(facilityId)) {
        coordinatorMap.set(facilityId, {
          count: 0,
          all_registered: true,
          coordinator_name: userInfo?.name || null,
          coordinator_email: userInfo?.email || null,
        });
      } else if (userInfo) {
        // If we already have an entry but this coordinator has user info, update it
        const existing = coordinatorMap.get(facilityId)!;
        if (!existing.coordinator_name && userInfo.name) {
          existing.coordinator_name = userInfo.name;
        }
        if (!existing.coordinator_email && userInfo.email) {
          existing.coordinator_email = userInfo.email;
        }
      }

      const facilityData = coordinatorMap.get(facilityId)!;
      facilityData.count++;

      // Check if this coordinator has completed registration
      // Must have logged in at least once (which means they've set a password)
      const authUser = authUsers.find(u => u.email === userInfo?.email);
      if (!authUser || !authUser.last_sign_in_at) {
        facilityData.all_registered = false;
      }
    });

    console.log('Coordinator map:', Object.fromEntries(coordinatorMap));

    const facilitiesWithCoordinators = facilities?.map(facility => ({
      ...facility,
      coordinator_count: coordinatorMap.get(facility.id)?.count || 0,
      coordinators_registered: coordinatorMap.get(facility.id)?.all_registered || false,
      coordinator_name: coordinatorMap.get(facility.id)?.coordinator_name || null,
      coordinator_email: coordinatorMap.get(facility.id)?.coordinator_email || null,
    }));

    return NextResponse.json(facilitiesWithCoordinators || []);
  } catch (error) {
    console.error('Get facilities error:', error);
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
      .from('facilities')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A facility with this slug already exists' },
        { status: 409 }
      );
    }

    // Create facility
    const { data, error } = await supabase
      .from('facilities')
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
    console.error('Create facility error:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Facility with this slug already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
