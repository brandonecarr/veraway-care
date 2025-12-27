'use client';

import { Card } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

interface ResolutionVelocityProps {
  data: {
    date: string;
    resolved: number;
    avgHours: number;
  }[];
  className?: string;
}

export function ResolutionVelocity({ data, className }: ResolutionVelocityProps) {
  const [period, setPeriod] = useState<'7day' | '30day'>('7day');

  const hasData = data && data.length > 0;

  // Filter data based on period
  const filteredData = hasData ? data.slice(-parseInt(period === '7day' ? '7' : '30')) : [];

  const maxResolved = hasData ? Math.max(...filteredData.map(d => d.resolved)) : 0;
  const avgResolved = hasData ? (filteredData.reduce((sum, d) => sum + d.resolved, 0) / filteredData.length).toFixed(1) : '0';

  // Calculate velocity trend (comparing first half to second half)
  const midpoint = Math.floor(filteredData.length / 2);
  const firstHalf = filteredData.slice(0, midpoint);
  const secondHalf = filteredData.slice(midpoint);

  const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, d) => sum + d.resolved, 0) / firstHalf.length : 0;
  const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, d) => sum + d.resolved, 0) / secondHalf.length : 0;
  const velocityChange = secondHalfAvg - firstHalfAvg;
  const velocityPercent = firstHalfAvg > 0 ? ((velocityChange / firstHalfAvg) * 100).toFixed(1) : '0';

  return (
    <Card className={cn("p-6 border-brand-border hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-brand-teal" />
            <h3 className="text-section-header font-display font-semibold">
              Resolution Velocity
            </h3>
          </div>
          <p className="text-metadata text-muted-foreground">
            Issues resolved per day
          </p>
        </div>
        {hasData && (
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7day' | '30day')}>
            <TabsList className="h-8">
              <TabsTrigger value="7day" className="text-xs">7 Days</TabsTrigger>
              <TabsTrigger value="30day" className="text-xs">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {hasData ? (
        <>
          {/* Velocity Indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {velocityChange > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-[#81B29A]" />
                  <span className="text-sm font-medium text-[#81B29A]">
                    {velocityPercent}% faster
                  </span>
                </>
              ) : velocityChange < 0 ? (
                <>
                  <TrendingDown className="w-4 h-4 text-[#E07A5F]" />
                  <span className="text-sm font-medium text-[#E07A5F]">
                    {Math.abs(parseFloat(velocityPercent))}% slower
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  Stable
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              resolution rate
            </span>
          </div>

          {/* Chart - Line with area */}
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
              {/* Area gradient */}
              <defs>
                <linearGradient id="velocityGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2D7A7A" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#2D7A7A" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Area */}
              <path
                d={generateAreaPath(filteredData, maxResolved)}
                fill="url(#velocityGradient)"
                className="transition-all duration-500"
              />

              {/* Line */}
              <path
                d={generateLinePath(filteredData, maxResolved)}
                fill="none"
                stroke="#2D7A7A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />

              {/* Data points */}
              {filteredData.map((item, index) => {
                const x = (index / (filteredData.length - 1)) * 400;
                const y = 150 - ((item.resolved / maxResolved) * 140);

                return (
                  <g key={index} className="group">
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#2D7A7A"
                      className="cursor-pointer hover:r-6 transition-all"
                    />
                    {/* Tooltip would go here if needed */}
                  </g>
                );
              })}
            </svg>

            {/* Date labels */}
            <div className="absolute inset-x-0 -bottom-6 flex justify-between text-[10px] text-muted-foreground">
              <span>
                {new Date(filteredData[0].date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
              <span>
                {new Date(filteredData[filteredData.length - 1].date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-brand-border">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Avg/Day</div>
              <div className="text-lg font-display font-semibold text-brand-teal">
                {avgResolved}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Peak Day</div>
              <div className="text-lg font-display font-semibold text-[#81B29A]">
                {maxResolved}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total</div>
              <div className="text-lg font-display font-semibold">
                {filteredData.reduce((sum, d) => sum + d.resolved, 0)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '340px' }}>
          <Activity className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No resolution data available yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Data will appear once issues are resolved</p>
        </div>
      )}
    </Card>
  );
}

// Helper functions to generate SVG paths
function generateLinePath(data: { resolved: number }[], maxValue: number): string {
  if (data.length === 0) return '';
  
  return data
    .map((item, index) => {
      const x = (index / (data.length - 1)) * 400;
      const y = 150 - ((item.resolved / maxValue) * 140);
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');
}

function generateAreaPath(data: { resolved: number }[], maxValue: number): string {
  if (data.length === 0) return '';
  
  const linePath = data
    .map((item, index) => {
      const x = (index / (data.length - 1)) * 400;
      const y = 150 - ((item.resolved / maxValue) * 140);
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');
  
  return `${linePath} L 400,150 L 0,150 Z`;
}
