import { createClient } from '../../../../supabase/server';
import { redirect } from 'next/navigation';
import AdvancedAnalytics from './advanced-analytics';

export default async function AnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/sign-in');
  }

  // Only coordinators should see advanced analytics
  if (profile.role !== 'coordinator') {
    redirect('/dashboard');
  }

  return <AdvancedAnalytics userId={user.id} />;
}
