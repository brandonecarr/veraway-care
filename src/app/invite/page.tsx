'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const router = useRouter();
  const hasProcessed = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processInvite = async () => {
      try {
        const supabase = createClient();

        // Check if there's a hash in the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('Hash params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type
        });

        if (accessToken && refreshToken) {
          // Manually set the session using the tokens from the URL
          console.log('Setting session from hash tokens...');
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            setError('Failed to process invite link. The link may have expired. Please request a new invitation.');
            return;
          }

          if (data.session) {
            console.log('Session established successfully');
            // Clear the hash from the URL
            window.history.replaceState(null, '', window.location.pathname);
            // Redirect to onboarding
            router.push('/onboarding');
          } else {
            setError('Failed to establish session. Please try again.');
          }
        } else {
          // No hash parameters, check if there's an existing session
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            console.log('Existing session found');
            router.push('/onboarding');
          } else {
            console.error('No tokens in URL and no existing session');
            setError('Invalid invite link. Please request a new invitation.');
          }
        }
      } catch (err) {
        console.error('Error processing invite:', err);
        setError('An error occurred while processing your invite. Please try again.');
      }
    };

    processInvite();
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
