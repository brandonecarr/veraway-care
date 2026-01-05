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

  // First get user's hospice_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('hospice_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData?.hospice_id) {
    return null;
  }

  // Then get hospice slug separately to avoid RLS join issues
  const { data: hospiceData, error: hospiceError } = await supabase
    .from('hospices')
    .select('slug')
    .eq('id', userData.hospice_id)
    .single();

  if (hospiceError || !hospiceData?.slug) {
    return null;
  }

  return hospiceData.slug;
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

  // First get user's hospice_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('hospice_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData?.hospice_id) {
    return null;
  }

  // Then get hospice data separately to avoid RLS join issues
  const { data: hospiceData, error: hospiceError } = await supabase
    .from('hospices')
    .select('id, slug, name')
    .eq('id', userData.hospice_id)
    .single();

  if (hospiceError || !hospiceData?.id || !hospiceData?.slug || !hospiceData?.name) {
    return null;
  }

  return {
    id: hospiceData.id,
    slug: hospiceData.slug,
    name: hospiceData.name,
  };
}

// Re-export with legacy names for backwards compatibility during transition
export const getUserFacilitySlug = getUserHospiceSlug;
export const getUserFacility = getUserHospice;
