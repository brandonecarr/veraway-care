'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const router = useRouter();

  useEffect(() => {
    handleInvite();
  }, []);

  const handleInvite = async () => {
    const supabase = createClient();

    // Check if we have a session from the hash
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      // Session established, redirect to onboarding
      router.push('/onboarding');
    } else {
      // No session, might be an error
      console.error('No session found in invite flow');
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#666]">Setting up your account...</p>
      </div>
    </div>
  );
}
