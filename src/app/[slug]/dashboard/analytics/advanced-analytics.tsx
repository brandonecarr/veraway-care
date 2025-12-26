'use client';

import { useState, useEffect } from 'react';
import { ResponseTimeTrends } from '@/components/care/response-time-trends';
import { ResolutionVelocity } from '@/components/care/resolution-velocity';
import { ClinicianWorkloadHeatmap } from '@/components/care/clinician-workload-heatmap';
import { IssueTypeDistribution } from '@/components/care/issue-type-distribution';
import { AnalyticsExport } from '@/components/care/analytics-export';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface AdvancedAnalyticsProps {
  userId: string;
}

export default function AdvancedAnalytics({ userId }: AdvancedAnalyticsProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<'7' | '30'>('30');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-brand-teal" />
                <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
                  Advanced Analytics
                </h1>
              </div>
              <p className="text-body text-muted-foreground mt-2">
                Deep insights for operational decisions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as '7' | '30')}>
              <TabsList>
                <TabsTrigger value="7">7 Days</TabsTrigger>
                <TabsTrigger value="30">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchAnalytics}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {analyticsData && (
              <AnalyticsExport data={analyticsData} filename="care-coordination-analytics" />
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[400px]" />
            </div>
            <Skeleton className="h-[500px]" />
            <Skeleton className="h-[400px]" />
          </div>
        ) : analyticsData ? (
          <>
            {/* Row 1: Response Time & Resolution Velocity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ResponseTimeTrends data={analyticsData.responseTimeTrends || []} />
              </div>
              <div 
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: '100ms' }}
              >
                <ResolutionVelocity data={analyticsData.resolutionVelocity || []} />
              </div>
            </div>

            {/* Row 2: Clinician Workload Heatmap */}
            <div 
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '200ms' }}
            >
              <ClinicianWorkloadHeatmap
                data={analyticsData.clinicianWorkload || []}
                onClinicianClick={(userId) => {
                  router.push(`/dashboard?assignedTo=${userId}`);
                }}
              />
            </div>

            {/* Row 3: Issue Type Distribution */}
            <div 
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '300ms' }}
            >
              <IssueTypeDistribution data={analyticsData.issueTypeDistribution || []} />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No analytics data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
