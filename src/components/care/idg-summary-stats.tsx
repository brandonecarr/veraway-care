'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { FileText, AlertTriangle, AlertCircle, Clock, UserPlus, Heart, CalendarClock } from 'lucide-react';

interface IDGSummaryStatsProps {
  data?: {
    totalIssues: number;
    byPriority: {
      urgent: number;
      high: number;
      normal: number;
      low: number;
    };
    overdue: number;
    admissions?: number;
    deaths?: number;
    expiringBenefitPeriods?: number;
  };
  isLoading: boolean;
}

export function IDGSummaryStats({ data, isLoading }: IDGSummaryStatsProps) {
  if (isLoading) {
    return (
      <>
        {/* Mobile: Horizontal scroll loading */}
        <div className="md:hidden -mx-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 px-4 pb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="w-[280px] flex-shrink-0">
                  <Card className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-9 w-9 rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-16" />
                  </Card>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        {/* Desktop: Grid loading */}
        <div className="hidden md:grid grid-cols-4 lg:grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Card key={i} className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-16" />
            </Card>
          ))}
        </div>
      </>
    );
  }

  const stats = [
    {
      label: 'Total Issues',
      value: data?.totalIssues ?? 0,
      icon: FileText,
      color: 'text-[#2D7A7A]',
      bgColor: 'bg-[#2D7A7A]/10'
    },
    {
      label: 'Urgent',
      value: data?.byPriority.urgent ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      label: 'High Priority',
      value: data?.byPriority.high ?? 0,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      label: 'Overdue',
      value: data?.overdue ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100'
    },
    {
      label: 'BP Expiring',
      value: data?.expiringBenefitPeriods ?? 0,
      icon: CalendarClock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Admissions',
      value: data?.admissions ?? 0,
      icon: UserPlus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Deaths',
      value: data?.deaths ?? 0,
      icon: Heart,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    }
  ];

  return (
    <>
      {/* Mobile: Horizontal scroll for stats */}
      <div className="md:hidden -mx-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 px-4 pb-4">
            {stats.map((stat) => (
              <div key={stat.label} className="w-[280px] flex-shrink-0">
                <Card className="p-4 md:p-6 transition-all duration-200 border shadow-card">
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {stat.label}
                    </h3>
                    <div className={`p-1.5 md:p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="space-y-1 md:space-y-2">
                    <p className="text-metric-hero-mobile md:text-metric-hero font-display">
                      {stat.value}
                    </p>
                  </div>
                </Card>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Desktop: Grid layout for stats */}
      <div className="hidden md:grid grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 md:p-6 transition-all duration-200 border shadow-card">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </h3>
              <div className={`p-1.5 md:p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-metric-hero-mobile md:text-metric-hero font-display">
                {stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
