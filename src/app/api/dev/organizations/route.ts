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

    // Fetch all organizations
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch coordinator counts for each organization
    const { data: coordinators } = await supabase
      .from('user_roles')
      .select('organization_id, user_id')
      .eq('role', 'coordinator');

    // Map coordinator counts to organizations
    const coordinatorMap = new Map<string, number>();
    coordinators?.forEach(coord => {
      coordinatorMap.set(
        coord.organization_id,
        (coordinatorMap.get(coord.organization_id) || 0) + 1
      );
    });

    const orgsWithCoordinators = orgs?.map(org => ({
      ...org,
      coordinator_count: coordinatorMap.get(org.id) || 0,
    }));

    return NextResponse.json(orgsWithCoordinators || []);
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { name, slug, subscription_tier, max_users } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 409 }
      );
    }

    // Create organization
    const { data, error } = await supabase
      .from('organizations')
      .insert([
        {
          name,
          slug,
          subscription_tier: subscription_tier || 'free',
          max_users: max_users || 10,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create organization error:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Organization with this slug already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
