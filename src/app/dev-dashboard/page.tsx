'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FacilityManagement } from '@/components/dev/facility-management';
import { Button } from '@/components/ui/button';
import { Building2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function DevDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if developer is logged in
    const devSession = localStorage.getItem('dev-session');
    if (devSession !== 'true') {
      router.push('/dev-login');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('dev-session');
    toast.success('Logged out successfully');
    router.push('/dev-login');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#2D7A7A] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-[#666]">Checking authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <nav className="w-full border-b border-[#D4D4D4] bg-white py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-[#2D7A7A] rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Developer Portal
              </h1>
              <p className="text-xs text-[#666]">Facility & User Management</p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <FacilityManagement />
      </div>
    </div>
  );
}
