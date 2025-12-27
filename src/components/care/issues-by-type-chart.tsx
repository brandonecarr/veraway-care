'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ISSUE_TYPE_COLORS } from '@/types/care-coordination';

interface IssuesByTypeChartProps {
  data: { type: string; count: number }[];
  onTypeClick?: (type: string) => void;
  onAddIssue?: () => void;
  className?: string;
}

export function IssuesByTypeChart({ data, onTypeClick, onAddIssue, className }: IssuesByTypeChartProps) {
  const hasData = data && data.length > 0;
  const maxCount = hasData ? Math.max(...data.map(d => d.count), 1) : 1;
  const sortedData = hasData ? [...data].sort((a, b) => b.count - a.count) : [];

  return (
    <Card className={cn('p-6 shadow-card h-full', className)}>
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-brand-teal" />
        <h2 className="text-section-title font-display">
          Issues by Type
        </h2>
      </div>

      {hasData ? (
        <>
          <div className="space-y-4">
            {sortedData.map((item) => {
              const percentage = (item.count / maxCount) * 100;
              const color = ISSUE_TYPE_COLORS[item.type] || '#6C757D';

              return (
                <div
                  key={item.type}
                  className={cn(
                    'group transition-all duration-200 touch-manipulation',
                    onTypeClick && 'cursor-pointer hover:opacity-80 active:scale-[0.99]'
                  )}
                  onClick={() => onTypeClick?.(item.type)}
                >
                  {/* Label and Count */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-body font-medium">{item.type}</span>
                    <span
                      className="text-lg font-display font-bold"
                      style={{ color }}
                    >
                      {item.count}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-8 bg-muted rounded-lg overflow-hidden group-hover:shadow-card transition-shadow">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-lg"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: `${color}20`,
                        borderLeft: `4px solid ${color}`,
                      }}
                    >
                      {/* Hover overlay */}
                      {onTypeClick && (
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: `${color}10` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total at bottom */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Issues</span>
            <span
              className="text-2xl font-bold"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {data.reduce((sum, item) => sum + item.count, 0)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center mb-4">
            <p className="text-muted-foreground mb-2">No issues yet</p>
            <p className="text-sm text-muted-foreground">Create your first issue to get started</p>
          </div>
          {onAddIssue && (
            <Button
              onClick={onAddIssue}
              className="bg-[#2D7A7A] hover:bg-[#236060] gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Issue
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
