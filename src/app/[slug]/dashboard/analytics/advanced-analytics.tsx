'use client';

import { useState, useEffect } from 'react';
import { ResponseTimeTrends } from '@/components/care/response-time-trends';
import { ResolutionVelocity } from '@/components/care/resolution-velocity';
import { ClinicianWorkloadHeatmap } from '@/components/care/clinician-workload-heatmap';
import { IssueTypeDistribution } from '@/components/care/issue-type-distribution';
import { AnalyticsExport } from '@/components/care/analytics-export';
import { ReportGenerator } from '@/components/care/report-generator';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
  { value: 'bimonth', label: 'Bi-Monthly' },
  { value: 'biannual', label: 'Bi-Annual' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

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
  const [issues, setIssues] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Fetch issues and metrics for report generation
  useEffect(() => {
    const fetchIssuesAndMetrics = async () => {
      try {
        const [issuesRes, metricsRes] = await Promise.all([
          fetch('/api/issues?includeResolved=true'),
          fetch('/api/metrics')
        ]);

        if (issuesRes.ok) {
          const issuesData = await issuesRes.json();
          setIssues(Array.isArray(issuesData) ? issuesData : []);
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }
      } catch (error) {
        console.error('Error fetching issues and metrics:', error);
      }
    };

    fetchIssuesAndMetrics();
  }, []);

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
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-2">Analytics</h1>
          <p className="text-sm md:text-base text-[#666]">Deep insights for operational decisions</p>
        </div>

        {/* Controls Section - full width to match cards */}
        <div className="space-y-4">
          {/* Date Range Dropdown and Action Buttons */}
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchAnalytics}
              disabled={isLoading}
              className="shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {analyticsData && (
              <AnalyticsExport data={analyticsData} filename="care-coordination-analytics" />
            )}
          </div>

          {/* Custom Date Pickers - shown when Custom is selected */}
          {period === 'custom' && (
            <div className="p-4 bg-white border border-[#D4D4D4] rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                {/* From Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
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
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
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
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[400px]" />
            </div>
            <Skeleton className="h-[500px]" />
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[350px]" />
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

            {/* Row 4: Report Generator */}
            <div
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '400ms' }}
            >
              <ReportGenerator issues={issues} metrics={metrics || {}} />
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
