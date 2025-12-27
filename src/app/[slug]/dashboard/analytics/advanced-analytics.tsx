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
  slug: string;
}

export default function AdvancedAnalytics({ userId, slug }: AdvancedAnalyticsProps) {
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
    <div className="min-h-screen bg-[#FAFAF8] pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6 md:space-y-8">
        {/* Header */}
        <div className="space-y-4">
          {/* Back button and title */}
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/${slug}/dashboard`)}
              className="shrink-0 mt-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-3">
                <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-brand-teal shrink-0" />
                <h1 className="text-2xl md:text-5xl font-display font-bold tracking-tight">
                  Advanced Analytics
                </h1>
              </div>
              <p className="text-sm md:text-body text-muted-foreground mt-1 md:mt-2">
                Deep insights for operational decisions
              </p>
            </div>
          </div>

          {/* Controls - stacked on mobile, inline on desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between pl-12 md:pl-14">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as '7' | '30')}>
              <TabsList>
                <TabsTrigger value="7">7 Days</TabsTrigger>
                <TabsTrigger value="30">30 Days</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              {analyticsData && (
                <AnalyticsExport data={analyticsData} filename="care-coordination-analytics" />
              )}
            </div>
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
                  router.push(`/${slug}/dashboard?assignedTo=${userId}`);
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
