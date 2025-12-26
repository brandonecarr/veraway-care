import { redirect } from 'next/navigation';
import { createClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import { NotificationPreferences } from '@/components/care/notification-preferences';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <DashboardNavbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-2">Settings</h1>
          <p className="text-sm md:text-base text-gray-600">
            Manage your notification preferences and account settings
          </p>
        </div>

        <div className="max-w-3xl">
          <div id="notifications" className="scroll-mt-8">
            <h2 className="text-xl md:text-2xl font-semibold text-[#1A1A1A] mb-4">
              Notifications
            </h2>
            <NotificationPreferences />
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
