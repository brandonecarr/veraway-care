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

    // Fetch coordinator roles WITH user data using Supabase join
    // This avoids the pagination issue by only fetching coordinator users
    const { data: coordinators } = await supabase
      .from('user_roles')
      .select('facility_id, user_id, users(id, email, name)')
      .eq('role', 'coordinator');

    // Get auth users for coordinators only to check registration status
    const coordinatorUserIds = coordinators?.map(c => c.user_id) || [];
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = authData?.users || [];

    // Map coordinator data to facilities
    const coordinatorMap = new Map<string, {
      count: number;
      all_registered: boolean;
      coordinator_name: string | null;
      coordinator_email: string | null;
    }>();

    coordinators?.forEach(coord => {
      const facilityId = coord.facility_id;
      // Handle both array and object response formats from Supabase join
      const userInfo = Array.isArray(coord.users) ? coord.users[0] : coord.users;

      if (!coordinatorMap.has(facilityId)) {
        coordinatorMap.set(facilityId, {
          count: 0,
          all_registered: true,
          coordinator_name: userInfo?.name || null,
          coordinator_email: userInfo?.email || null,
        });
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
