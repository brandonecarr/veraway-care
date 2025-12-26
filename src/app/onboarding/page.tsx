'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Building2, Mail, User } from 'lucide-react';

interface FacilityInfo {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [facility, setFacility] = useState<FacilityInfo | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // No session, redirect to home
      router.push('/');
      return;
    }

    setUserEmail(user.email || '');
    setUserName(user.user_metadata?.name || user.user_metadata?.full_name || '');

    // Fetch user's facility information
    // Note: This may fail if multi-tenancy migrations haven't been applied yet
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('facility_id, facilities(id, name, slug, subscription_tier)')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        // Gracefully handle error - user can still complete onboarding without facility info
      } else if (userData?.facilities) {
        // facilities is returned as an array by Supabase, get the first element
        const facilityData = Array.isArray(userData.facilities)
          ? userData.facilities[0]
          : userData.facilities;
        setFacility(facilityData as FacilityInfo);
      }
    } catch (error) {
      console.error('Error fetching facility data:', error);
      // Continue anyway - facility display is optional
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Account setup complete! Redirecting to dashboard...');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error('Failed to set password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome to Veraway Care
          </h1>
          <p className="text-[#666]">
            Complete your account setup to get started
          </p>
        </div>

        {/* User & Facility Information */}
        <div className="mb-8 space-y-4">
          <div className="bg-[#2D7A7A]/5 border border-[#2D7A7A]/20 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-[#1A1A1A]">Your Information</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full">
                  <User className="w-5 h-5 text-[#2D7A7A]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">Name</p>
                  <p className="font-medium text-[#1A1A1A]">{userName || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full">
                  <Mail className="w-5 h-5 text-[#2D7A7A]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">Email</p>
                  <p className="font-medium text-[#1A1A1A]">{userEmail}</p>
                </div>
              </div>
            </div>
          </div>

          {facility && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#1A1A1A]">Facility Assignment</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">You've been assigned as coordinator for</p>
                  <p className="font-semibold text-[#1A1A1A] text-lg">{facility.name}</p>
                  <p className="text-xs text-[#666] mt-1">
                    {facility.subscription_tier.charAt(0).toUpperCase() + facility.subscription_tier.slice(1)} Plan
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Password Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-t border-[#E0E0E0] pt-6">
            <h2 className="text-lg font-semibold mb-4 text-[#1A1A1A]">Set Your Password</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#1A1A1A]">
                  New Password *
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-1"
                  minLength={8}
                />
                <p className="text-xs text-[#666] mt-1">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-[#1A1A1A]">
                  Confirm Password *
                </label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="mt-1"
                  minLength={8}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
          >
            {isSubmitting ? 'Completing Setup...' : 'Complete Setup'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
