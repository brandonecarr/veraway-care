'use client';

import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

interface ResponseTimeTrendsProps {
  data: {
    date: string;
    avgResponseTime: number;
    count: number;
  }[];
  className?: string;
}

export function ResponseTimeTrends({ data, className }: ResponseTimeTrendsProps) {
  const [period, setPeriod] = useState<'7day' | '30day'>('7day');

  if (!data || data.length === 0) {
    return null;
  }

  // Filter data based on period
  const filteredData = data.slice(-parseInt(period === '7day' ? '7' : '30'));
  
  // Calculate trend
  const firstValue = filteredData[0]?.avgResponseTime || 0;
  const lastValue = filteredData[filteredData.length - 1]?.avgResponseTime || 0;
  const trend = lastValue - firstValue;
  const trendPercent = firstValue > 0 ? ((trend / firstValue) * 100).toFixed(1) : '0';

  const maxTime = Math.max(...filteredData.map(d => d.avgResponseTime));
  const minTime = Math.min(...filteredData.map(d => d.avgResponseTime));

  return (
    <Card className={cn("p-6 border-brand-border hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-brand-teal" />
            <h3 className="text-section-header font-display font-semibold">
              Response Time Trends
            </h3>
          </div>
          <p className="text-metadata text-muted-foreground">
            Average response time over time
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7day' | '30day')}>
          <TabsList className="h-8">
            <TabsTrigger value="7day" className="text-xs">7 Days</TabsTrigger>
            <TabsTrigger value="30day" className="text-xs">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Trend Indicator */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          {trend < 0 ? (
            <>
              <TrendingDown className="w-4 h-4 text-[#81B29A]" />
              <span className="text-sm font-medium text-[#81B29A]">
                {Math.abs(parseFloat(trendPercent))}% faster
              </span>
            </>
          ) : trend > 0 ? (
            <>
              <TrendingUp className="w-4 h-4 text-[#E07A5F]" />
              <span className="text-sm font-medium text-[#E07A5F]">
                {trendPercent}% slower
              </span>
            </>
          ) : (
            <>
              <Minus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                No change
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          vs. start of period
        </span>
      </div>

      {/* Chart */}
      <div className="relative h-48">
        <div className="absolute inset-0 flex items-end justify-between gap-1">
          {filteredData.map((item, index) => {
            const height = maxTime > minTime 
              ? ((item.avgResponseTime - minTime) / (maxTime - minTime)) * 100 
              : 50;
            const normalizedHeight = Math.max(height, 5); // Minimum 5% height

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="relative w-full">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all duration-300",
                      "bg-brand-teal hover:bg-brand-teal/80"
                    )}
                    style={{ height: `${normalizedHeight}%` }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-[#1A1A1A] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        <div className="font-medium">{item.avgResponseTime.toFixed(1)}h</div>
                        <div className="text-[10px] opacity-75">{item.count} issues</div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {new Date(item.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-brand-border">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Average</div>
          <div className="text-lg font-display font-semibold text-brand-teal">
            {(filteredData.reduce((sum, d) => sum + d.avgResponseTime, 0) / filteredData.length).toFixed(1)}h
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Best</div>
          <div className="text-lg font-display font-semibold text-[#81B29A]">
            {minTime.toFixed(1)}h
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Worst</div>
          <div className="text-lg font-display font-semibold text-[#E07A5F]">
            {maxTime.toFixed(1)}h
          </div>
        </div>
      </div>
    </Card>
  );
}
