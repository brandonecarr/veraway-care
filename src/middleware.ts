import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Check if there's a hash in the URL (for invite flows)
  const url = request.nextUrl.clone();
  if (url.hash && url.hash.includes('type=invite')) {
    // Redirect to onboarding
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  const { data: { user } } = await supabase.auth.getUser();

  // Handle facility-specific routing
  if (user) {
    const pathname = request.nextUrl.pathname;

    try {
      // If user is accessing /dashboard without a slug, redirect to facility-specific URL
      if (pathname.startsWith('/dashboard')) {
        // Get user's facility slug and onboarding status - use maybeSingle to avoid errors if no row exists
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('facility_id, onboarding_completed_at, facilities!users_organization_id_fkey(slug)')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) {
          console.error('Middleware: Error fetching user data:', userError);
          // Don't block user, let them through to handle error in the page
          return response;
        }

        // Check if user is an admin - use maybeSingle to avoid errors if no role exists
        const { data: userRoleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) {
          console.error('Middleware: Error fetching user role:', roleError);
          // Continue without role check
        }

        if (userRoleData?.role === 'admin') {
          // Admins can access dev-dashboard instead
          return NextResponse.redirect(new URL('/dev-dashboard', request.url));
        }

        // Check if onboarding is completed - if not, redirect to onboarding
        if (!userData?.onboarding_completed_at) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }

        if (userData?.facilities) {
          const facility = Array.isArray(userData.facilities)
            ? userData.facilities[0]
            : userData.facilities;

          if (facility?.slug) {
            // Redirect to facility-specific URL
            const newPath = pathname.replace('/dashboard', `/${facility.slug}/dashboard`);
            return NextResponse.redirect(new URL(newPath + request.nextUrl.search, request.url));
          }
        }

        // If no facility found, redirect to onboarding
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }

      // If accessing /:slug/dashboard, verify the slug matches user's facility
      const slugMatch = pathname.match(/^\/([^\/]+)\/dashboard/);
      if (slugMatch) {
        const slug = slugMatch[1];

        // Get user's facility slug and onboarding status to verify - use maybeSingle
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('facility_id, onboarding_completed_at, facilities!users_organization_id_fkey(slug)')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) {
          console.error('Middleware: Error fetching user data for slug verification:', userError);
          // Don't block user, let them through
          return response;
        }

        // Check if onboarding is completed - if not, redirect to onboarding
        if (!userData?.onboarding_completed_at) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }

        if (userData?.facilities) {
          const facility = Array.isArray(userData.facilities)
            ? userData.facilities[0]
            : userData.facilities;

          // Verify slug matches user's facility
          if (facility?.slug && facility.slug !== slug) {
            // Redirect to correct facility slug
            const newPath = pathname.replace(`/${slug}/`, `/${facility.slug}/`);
            return NextResponse.redirect(new URL(newPath + request.nextUrl.search, request.url));
          }
        }
      }
    } catch (error) {
      console.error('Middleware: Unexpected error:', error);
      // On any error, let the request through rather than blocking the user
      return response;
    }
  }

  // Protected routes - require authentication for facility-specific dashboard routes
  if (request.nextUrl.pathname.match(/^\/[^\/]+\/dashboard/) && !user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Also protect old /dashboard routes (will be redirected above if authenticated)
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
