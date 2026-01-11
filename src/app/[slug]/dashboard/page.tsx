import DashboardNavbar from "@/components/dashboard-navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CareCoordinationDashboard } from "@/components/care/dashboard";
import { MobileBottomNav } from "@/components/care/mobile-bottom-nav";
import { getUserRole } from "@/lib/care-coordination";
import { PasswordResetToast } from "@/components/password-reset-toast";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const userRole = await getUserRole(user.id);

  return (
    <>
      <Suspense fallback={null}>
        <PasswordResetToast />
      </Suspense>
      <DashboardNavbar />
      <CareCoordinationDashboard userId={user.id} userRole={userRole} />
      <MobileBottomNav />
    </>
  );
}
