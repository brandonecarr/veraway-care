import DashboardNavbar from "@/components/dashboard-navbar";
import { createClient } from "../../../supabase/server";
import { redirect } from "next/navigation";
import { CareCoordinationDashboard } from "@/components/care/dashboard";
import { MobileBottomNav } from "@/components/care/mobile-bottom-nav";
import { getUserRole } from "@/lib/care-coordination";

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
      <DashboardNavbar />
      <CareCoordinationDashboard userId={user.id} userRole={userRole} />
      <MobileBottomNav />
    </>
  );
}
