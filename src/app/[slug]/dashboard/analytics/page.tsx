import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdvancedAnalytics from './advanced-analytics';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is coordinator
  const { data: userData } = await supabase
    .from('users')
    .select('facility_id')
    .eq('id', user.id)
    .single();

  if (!userData?.facility_id) {
    redirect('/sign-in');
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('facility_id', userData.facility_id)
    .single();

  const isCoordinator = roleData?.role === 'coordinator';

  // Only coordinators should see advanced analytics
  if (!isCoordinator) {
    redirect(`/${params.slug}/dashboard`);
  }

  return <AdvancedAnalytics userId={user.id} />;
}
