import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdvancedAnalytics from './advanced-analytics';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is coordinator - use maybeSingle to avoid errors if no role exists
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const userRole = roleData?.role || 'clinician';

  // Coordinators and clinicians can see analytics (not after_hours)
  if (userRole === 'after_hours') {
    redirect(`/${params.slug}/dashboard`);
  }

  return (
    <>
      <DashboardNavbar />
      <AdvancedAnalytics userId={user.id} slug={params.slug} />
      <MobileBottomNav />
    </>
  );
}
