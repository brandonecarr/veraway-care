'use client';

import { usePathname } from 'next/navigation';

/**
 * Client-side hook to extract the hospice slug from the current pathname
 * Returns the slug if present in the URL pattern /:slug/dashboard
 * Returns null if not in a hospice-scoped route
 */
export function useHospiceSlug(): string | null {
  const pathname = usePathname();

  // Extract slug from pathname like /sunrise-hospice-care/dashboard
  const match = pathname?.match(/^\/([^\/]+)\/dashboard/);

  return match ? match[1] : null;
}

/**
 * Get the hospice-scoped path for a given route
 * E.g., getPath('/patients') with slug 'sunrise-hospice-care' returns '/sunrise-hospice-care/dashboard/patients'
 */
export function useHospicePath() {
  const slug = useHospiceSlug();

  return function getPath(path: string): string {
    if (!slug) {
      // Fallback to non-scoped path if no slug (shouldn't normally happen in dashboard)
      return `/dashboard${path}`;
    }

    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    return `/${slug}/dashboard${cleanPath ? `/${cleanPath}` : ''}`;
  };
}

// Re-export with legacy names for backwards compatibility during transition
export const useFacilitySlug = useHospiceSlug;
export const useFacilityPath = useHospicePath;
