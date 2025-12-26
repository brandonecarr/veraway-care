'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (hasRedirected.current) return;

      console.log('Auth state change:', event, session);

      if (event === 'SIGNED_IN' && session) {
        // User successfully signed in via invite link
        hasRedirected.current = true;
        router.push('/onboarding');
      } else if (event === 'PASSWORD_RECOVERY') {
        // Handle password recovery separately if needed
        hasRedirected.current = true;
        router.push('/onboarding');
      }
    });

    // Also check if session already exists (in case the page was refreshed)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !hasRedirected.current) {
        hasRedirected.current = true;
        router.push('/onboarding');
      }
    };

    checkExistingSession();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#666]">Setting up your account...</p>
      </div>
    </div>
  );
}
