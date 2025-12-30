'use client';

import { useState, useEffect } from 'react';
import { ResponseTimeTrends } from '@/components/care/response-time-trends';
import { ResolutionVelocity } from '@/components/care/resolution-velocity';
import { ClinicianWorkloadHeatmap } from '@/components/care/clinician-workload-heatmap';
import { IssueTypeDistribution } from '@/components/care/issue-type-distribution';
import { AnalyticsExport } from '@/components/care/analytics-export';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, BarChart3, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

type PeriodType = '7' | '14' | '30' | '60' | '90' | 'bimonth' | 'biannual' | 'year' | 'custom';

interface AdvancedAnalyticsProps {
  userId: string;
  slug: string;
}

export default function AdvancedAnalytics({ userId, slug }: AdvancedAnalyticsProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodType>('30');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (period !== 'custom') {
      fetchAnalytics();
    }
  }, [period]);

  // Fetch when custom dates change
  useEffect(() => {
    if (period === 'custom' && customStartDate && customEndDate) {
      fetchAnalytics();
    }
  }, [customStartDate, customEndDate, period]);

  const getPeriodDays = (p: PeriodType): number => {
    switch (p) {
      case '7': return 7;
      case '14': return 14;
      case '30': return 30;
      case '60': return 60;
      case '90': return 90;
      case 'bimonth': return 60; // 2 months
      case 'biannual': return 180; // 6 months
      case 'year': return 365;
      default: return 30;
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      let url = `/api/analytics?period=${getPeriodDays(period)}`;

      if (period === 'custom' && customStartDate && customEndDate) {
        url = `/api/analytics?startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }

      const response = await fetch(url);
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
          <div className="flex flex-col gap-3 pl-12 md:pl-14">
            {/* Date Range Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="7" className="text-xs sm:text-sm">7 Days</TabsTrigger>
                  <TabsTrigger value="14" className="text-xs sm:text-sm">14 Days</TabsTrigger>
                  <TabsTrigger value="30" className="text-xs sm:text-sm">30 Days</TabsTrigger>
                  <TabsTrigger value="60" className="text-xs sm:text-sm">60 Days</TabsTrigger>
                  <TabsTrigger value="90" className="text-xs sm:text-sm">90 Days</TabsTrigger>
                  <TabsTrigger value="bimonth" className="text-xs sm:text-sm">Bi-Month</TabsTrigger>
                  <TabsTrigger value="biannual" className="text-xs sm:text-sm">Bi-Annual</TabsTrigger>
                  <TabsTrigger value="year" className="text-xs sm:text-sm">Year</TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs sm:text-sm">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Custom Date Pickers - shown when Custom is selected */}
            {period === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-[#D4D4D4] rounded-lg">
                <span className="text-sm text-muted-foreground">From:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal min-w-[140px]",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date() || (customEndDate ? date > customEndDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-sm text-muted-foreground">To:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal min-w-[140px]",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => date > new Date() || (customStartDate ? date < customStartDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Action buttons */}
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
