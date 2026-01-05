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

  // Handle hospice-specific routing
  if (user) {
    const pathname = request.nextUrl.pathname;

    try {
      // If user is on /onboarding, check if they've already completed onboarding
      if (pathname === '/onboarding') {
        const { data: rpcData, error: userError } = await supabase
          .rpc('get_user_for_middleware', { p_user_id: user.id })
          .maybeSingle();

        console.log('Middleware: Onboarding page - RPC result:', { rpcData, userError, userId: user.id });

        const userData = rpcData as { hospice_id: string; onboarding_completed_at: string } | null;

        if (!userError && userData?.onboarding_completed_at && userData?.hospice_id) {
          // User has completed onboarding, get their hospice slug and redirect to dashboard
          const { data: slugData } = await supabase
            .rpc('get_hospice_slug', { p_hospice_id: userData.hospice_id })
            .maybeSingle();

          const hospiceSlug = slugData as string | null;
          console.log('Middleware: User already onboarded, redirecting to dashboard. Slug:', hospiceSlug);

          if (hospiceSlug) {
            return NextResponse.redirect(new URL(`/${hospiceSlug}/dashboard`, request.url));
          } else {
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      }

      // If user is accessing /dashboard without a slug, redirect to hospice-specific URL
      if (pathname.startsWith('/dashboard')) {
        // Use RPC function to bypass RLS issues
        const { data: rpcData, error: userError } = await supabase
          .rpc('get_user_for_middleware', { p_user_id: user.id })
          .maybeSingle();

        console.log('Middleware: RPC result for get_user_for_middleware:', { rpcData, userError, userId: user.id });

        const userData = rpcData as { hospice_id: string; onboarding_completed_at: string } | null;

        if (userError) {
          console.error('Middleware: Error fetching user data:', userError);
          // Don't block user, let them through to handle error in the page
          return response;
        }

        if (!userData) {
          console.error('Middleware: No user data returned from RPC for user:', user.id);
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

        // Use RPC function to get hospice slug
        if (userData?.hospice_id) {
          const { data: slugData } = await supabase
            .rpc('get_hospice_slug', { p_hospice_id: userData.hospice_id })
            .maybeSingle();

          const hospiceSlug = slugData as string | null;

          if (hospiceSlug) {
            // Redirect to hospice-specific URL
            const newPath = pathname.replace('/dashboard', `/${hospiceSlug}/dashboard`);
            return NextResponse.redirect(new URL(newPath + request.nextUrl.search, request.url));
          }
        }

        // If no hospice found, redirect to onboarding
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }

      // If accessing /:slug/dashboard, verify the slug matches user's hospice
      const slugMatch = pathname.match(/^\/([^\/]+)\/dashboard/);
      if (slugMatch) {
        const slug = slugMatch[1];

        // Use RPC function to bypass RLS issues
        const { data: rpcData, error: userError } = await supabase
          .rpc('get_user_for_middleware', { p_user_id: user.id })
          .maybeSingle();

        const userData = rpcData as { hospice_id: string; onboarding_completed_at: string } | null;

        if (userError) {
          console.error('Middleware: Error fetching user data for slug verification:', userError);
          // Don't block user, let them through
          return response;
        }

        // Check if onboarding is completed - if not, redirect to onboarding
        if (!userData?.onboarding_completed_at) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }

        // Use RPC function to get hospice slug
        if (userData?.hospice_id) {
          const { data: slugData } = await supabase
            .rpc('get_hospice_slug', { p_hospice_id: userData.hospice_id })
            .maybeSingle();

          const hospiceSlug = slugData as string | null;

          // Verify slug matches user's hospice
          if (hospiceSlug && hospiceSlug !== slug) {
            // Redirect to correct hospice slug
            const newPath = pathname.replace(`/${slug}/`, `/${hospiceSlug}/`);
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

  // Protected routes - require authentication for hospice-specific dashboard routes
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
