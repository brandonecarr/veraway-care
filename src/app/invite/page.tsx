'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const router = useRouter();
  const hasRedirected = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let authSubscription: any;

    const handleInvite = async () => {
      try {
        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (hasRedirected.current) return;

          console.log('Auth state change:', event, session);

          // Handle different auth events
          if (event === 'SIGNED_IN' && session) {
            hasRedirected.current = true;
            router.push('/onboarding');
          } else if (event === 'INITIAL_SESSION' && session) {
            // Session was restored from storage
            hasRedirected.current = true;
            router.push('/onboarding');
          } else if (event === 'PASSWORD_RECOVERY') {
            hasRedirected.current = true;
            router.push('/onboarding');
          }
        });

        authSubscription = subscription;

        // Give Supabase a moment to process the hash parameters
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check for session after allowing hash processing
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Failed to process invite link. Please try again or contact support.');
          return;
        }

        if (session && !hasRedirected.current) {
          hasRedirected.current = true;
          router.push('/onboarding');
        } else if (!session) {
          // No session after waiting - there might be an issue
          console.warn('No session found after processing invite');
          // Wait a bit longer for the auth state change event
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check one more time
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession && !hasRedirected.current) {
            hasRedirected.current = true;
            router.push('/onboarding');
          } else if (!hasRedirected.current) {
            setError('Unable to process invite link. The link may have expired. Please request a new invitation.');
          }
        }
      } catch (err) {
        console.error('Error processing invite:', err);
        setError('An error occurred while processing your invite. Please try again.');
      }
    };

    handleInvite();

    // Cleanup subscription
    return () => {
      authSubscription?.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Invite Link Error</h2>
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="text-[#2D7A7A] hover:underline"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#666]">Setting up your account...</p>
        <p className="text-xs text-[#999] mt-2">Processing your invitation</p>
      </div>
    </div>
  );
}
