'use client';

import { Card } from '@/components/ui/card';
import { PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ISSUE_TYPE_COLORS } from '@/types/care-coordination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

interface IssueTypeDistributionProps {
  data: {
    date: string;
    distribution: { type: string; count: number }[];
  }[];
  className?: string;
}

export function IssueTypeDistribution({ data, className }: IssueTypeDistributionProps) {
  const [period, setPeriod] = useState<'7day' | '30day'>('30day');

  if (!data || data.length === 0) {
    return null;
  }

  // Filter data based on period
  const filteredData = data.slice(-parseInt(period === '7day' ? '7' : '30'));

  // Aggregate type counts over the period
  const aggregatedTypes: Record<string, number> = {};
  filteredData.forEach(day => {
    day.distribution.forEach(item => {
      aggregatedTypes[item.type] = (aggregatedTypes[item.type] || 0) + item.count;
    });
  });

  // Sort by count
  const sortedTypes = Object.entries(aggregatedTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const totalCount = sortedTypes.reduce((sum, item) => sum + item.count, 0);

  // Calculate trend for each type
  const getTypeTrend = (type: string) => {
    if (filteredData.length < 2) return 0;
    
    const midpoint = Math.floor(filteredData.length / 2);
    const firstHalf = filteredData.slice(0, midpoint);
    const secondHalf = filteredData.slice(midpoint);
    
    const firstHalfCount = firstHalf.reduce((sum, day) => {
      const item = day.distribution.find(d => d.type === type);
      return sum + (item?.count || 0);
    }, 0);
    
    const secondHalfCount = secondHalf.reduce((sum, day) => {
      const item = day.distribution.find(d => d.type === type);
      return sum + (item?.count || 0);
    }, 0);
    
    const firstHalfAvg = firstHalfCount / firstHalf.length;
    const secondHalfAvg = secondHalfCount / secondHalf.length;
    
    return firstHalfAvg > 0 
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
      : 0;
  };

  return (
    <Card className={cn("p-6 border-brand-border hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-5 h-5 text-brand-teal" />
            <h3 className="text-section-header font-display font-semibold">
              Issue Type Distribution
            </h3>
          </div>
          <p className="text-metadata text-muted-foreground">
            Distribution over time
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7day' | '30day')}>
          <TabsList className="h-8">
            <TabsTrigger value="7day" className="text-xs">7 Days</TabsTrigger>
            <TabsTrigger value="30day" className="text-xs">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Distribution Bars */}
      <div className="space-y-3">
        {sortedTypes.map((item, index) => {
          const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
          const trend = getTypeTrend(item.type);
          const color = ISSUE_TYPE_COLORS[item.type] || '#6C757D';

          return (
            <div
              key={item.type}
              className="group"
              style={{ 
                animationDelay: `${index * 50}ms`,
                animation: 'fadeIn 0.3s ease-in-out'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium truncate">
                    {item.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="text-sm font-display font-semibold min-w-[40px] text-right">
                    {item.count}
                  </span>
                  {trend !== 0 && (
                    <span className={cn(
                      "text-[10px] font-medium min-w-[45px] text-right",
                      trend > 0 ? "text-[#E07A5F]" : "text-[#81B29A]"
                    )}>
                      {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-brand-border grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Total Issues</div>
          <div className="text-2xl font-display font-bold text-brand-teal">
            {totalCount}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Categories</div>
          <div className="text-2xl font-display font-bold">
            {sortedTypes.length}
          </div>
        </div>
      </div>
    </Card>
  );
}
