'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle, AlertCircle, Clock, UserPlus, Heart } from 'lucide-react';

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
  };
  isLoading: boolean;
}

export function IDGSummaryStats({ data, isLoading }: IDGSummaryStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 bg-white border-[#D4D4D4]">
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4 bg-white border-[#D4D4D4]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
