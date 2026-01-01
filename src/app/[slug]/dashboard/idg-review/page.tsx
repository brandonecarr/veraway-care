import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import IDGReviewClient from './idg-review-client';

export const dynamic = 'force-dynamic';

export default async function IDGReviewPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is coordinator - coordinators only
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const userRole = roleData?.role || 'clinician';

  // Only coordinators can access IDG Review
  if (userRole !== 'coordinator') {
    redirect(`/${params.slug}/dashboard`);
  }

  return (
    <>
      <DashboardNavbar />
      <IDGReviewClient slug={params.slug} />
      <MobileBottomNav />
    </>
  );
}
