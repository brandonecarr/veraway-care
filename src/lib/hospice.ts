import { createClient } from '@/lib/supabase/server';

/**
 * Get the hospice slug for the current authenticated user
 * Returns null if user is not authenticated or has no hospice assigned
 */
export async function getUserHospiceSlug(): Promise<string | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('hospice_id, hospices(slug)')
    .eq('id', user.id)
    .single();

  if (error || !data?.hospices) {
    return null;
  }

  // hospices is returned as an array by Supabase, get the first element
  const hospice = Array.isArray(data.hospices) ? data.hospices[0] : data.hospices;

  return hospice?.slug || null;
}

/**
 * Get the hospice information for the current authenticated user
 */
export async function getUserHospice(): Promise<{
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
    .select('hospice_id, hospices(id, slug, name)')
    .eq('id', user.id)
    .single();

  if (error || !data?.hospices) {
    return null;
  }

  // hospices is returned as an array by Supabase, get the first element
  const hospice = Array.isArray(data.hospices) ? data.hospices[0] : data.hospices;

  if (!hospice?.id || !hospice?.slug || !hospice?.name) {
    return null;
  }

  return {
    id: hospice.id,
    slug: hospice.slug,
    name: hospice.name,
  };
}

// Re-export with legacy names for backwards compatibility during transition
export const getUserFacilitySlug = getUserHospiceSlug;
export const getUserFacility = getUserHospice;
