import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuditLogTable } from '@/components/care/audit-log-table';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import { Card } from '@/components/ui/card';
import { Shield, Activity, FileText, Users } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  // Get user's facility
  const { data: userData } = await supabase
    .from('users')
    .select('facility_id')
    .eq('id', user.id)
    .single();

  if (!userData?.facility_id) {
    redirect('/sign-in');
  }

  // Get audit stats for the header
  const { count: totalEntries } = await supabase
    .from('issue_audit_log')
    .select('*', { count: 'exact', head: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: todayEntries } = await supabase
    .from('issue_audit_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  const { count: uniqueUsers } = await supabase
    .from('issue_audit_log')
    .select('user_id', { count: 'exact', head: true });

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <DashboardNavbar />
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-7xl pb-24 md:pb-8">
        <div className="space-y-6 md:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Audit Log
              </h1>
              <p className="text-sm md:text-base text-[#666]">
                Complete forensic trail of all issue activities and system changes
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-white px-4 py-2 rounded-lg border border-[#D4D4D4]">
              <Shield className="w-4 h-4 text-[#2D7A7A]" />
              <span>Audit-Ready Compliance</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-white border-[#D4D4D4]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-[#2D7A7A]/10">
                  <Activity className="w-5 h-5 text-[#2D7A7A]" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                    {totalEntries || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Audit Entries</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-white border-[#D4D4D4]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-[#81B29A]/10">
                  <FileText className="w-5 h-5 text-[#81B29A]" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                    {todayEntries || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Actions Today</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-white border-[#D4D4D4]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-[#E07A5F]/10">
                  <Users className="w-5 h-5 text-[#E07A5F]" />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                    Active
                  </p>
                  <p className="text-xs text-muted-foreground">Tracking Status</p>
                </div>
              </div>
            </Card>
          </div>

          <ErrorBoundary>
            <AuditLogTable />
          </ErrorBoundary>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
