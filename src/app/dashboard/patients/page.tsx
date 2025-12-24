import DashboardNavbar from '@/components/dashboard-navbar';
import { createClient } from '../../../../supabase/server';
import { redirect } from 'next/navigation';
import { PatientList } from '@/components/care/patient-list';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';

export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  return (
    <>
      <DashboardNavbar />
      <div className="min-h-screen bg-[#FAFAF8] px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-2">Patients</h1>
            <p className="text-sm md:text-base text-[#666]">Manage patient records and information</p>
          </div>
          <PatientList />
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
}
