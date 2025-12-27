import { createClient } from '@/lib/supabase/server';

/**
 * Get the facility slug for the current authenticated user
 * Returns null if user is not authenticated or has no facility assigned
 */
export async function getUserFacilitySlug(): Promise<string | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('facility_id, facilities(slug)')
    .eq('id', user.id)
    .single();

  if (error || !data?.facilities) {
    return null;
  }

  // facilities is returned as an array by Supabase, get the first element
  const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities;

  return facility?.slug || null;
}

/**
 * Get the facility information for the current authenticated user
 */
export async function getUserFacility(): Promise<{
  id: string;
  slug: string;
  name: string;
} | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('facility_id, facilities(id, slug, name)')
    .eq('id', user.id)
    .single();

  if (error || !data?.facilities) {
    return null;
  }

  // facilities is returned as an array by Supabase, get the first element
  const facility = Array.isArray(data.facilities) ? data.facilities[0] : data.facilities;

  if (!facility?.id || !facility?.slug || !facility?.name) {
    return null;
  }

  return {
    id: facility.id,
    slug: facility.slug,
    name: facility.name,
  };
}
