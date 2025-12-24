'use client';

import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ClinicianWorkloadHeatmapProps {
  data: {
    userId: string;
    name: string;
    email: string;
    assignedCount: number;
    resolvedCount: number;
    overdueCount: number;
    avgCompletionTime: number;
  }[];
  className?: string;
  onClinicianClick?: (userId: string) => void;
}

export function ClinicianWorkloadHeatmap({ 
  data, 
  className,
  onClinicianClick 
}: ClinicianWorkloadHeatmapProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const maxAssigned = Math.max(...data.map(d => d.assignedCount));
  const maxOverdue = Math.max(...data.map(d => d.overdueCount));

  // Sort by assigned count (highest workload first)
  const sortedData = [...data].sort((a, b) => b.assignedCount - a.assignedCount);

  return (
    <Card className={cn("p-6 border-brand-border hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-brand-teal" />
            <h3 className="text-section-header font-display font-semibold">
              Clinician Workload
            </h3>
          </div>
          <p className="text-metadata text-muted-foreground">
            Current assignment distribution and performance
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="space-y-3">
        {sortedData.map((clinician) => {
          const workloadIntensity = maxAssigned > 0 
            ? (clinician.assignedCount / maxAssigned) * 100 
            : 0;
          
          const overdueIntensity = maxOverdue > 0 && clinician.overdueCount > 0
            ? (clinician.overdueCount / maxOverdue) * 100
            : 0;

          const initials = clinician.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={clinician.userId}
              className={cn(
                "group relative p-4 rounded-lg border transition-all duration-300",
                "hover:shadow-md cursor-pointer",
                onClinicianClick && "hover:border-brand-teal"
              )}
              style={{
                background: `linear-gradient(to right, 
                  rgba(45, 122, 122, ${workloadIntensity / 200}) 0%, 
                  rgba(45, 122, 122, ${workloadIntensity / 400}) 100%
                )`,
                borderColor: overdueIntensity > 50 ? '#E07A5F' : '#D4D4D4',
              }}
              onClick={() => onClinicianClick?.(clinician.userId)}
            >
              <div className="flex items-center justify-between">
                {/* Clinician Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-brand-teal text-white text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#1A1A1A] truncate">
                      {clinician.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {clinician.email}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4">
                  {/* Assigned */}
                  <div className="text-center">
                    <div className="text-lg font-display font-bold text-brand-teal">
                      {clinician.assignedCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Assigned
                    </div>
                  </div>

                  {/* Resolved */}
                  <div className="text-center">
                    <div className="text-lg font-display font-bold text-[#81B29A]">
                      {clinician.resolvedCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Resolved
                    </div>
                  </div>

                  {/* Overdue */}
                  {clinician.overdueCount > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-display font-bold text-[#E07A5F]">
                        {clinician.overdueCount}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Overdue
                      </div>
                    </div>
                  )}

                  {/* Avg Completion */}
                  <div className="text-center min-w-[60px]">
                    <div className="text-sm font-display font-semibold">
                      {clinician.avgCompletionTime.toFixed(1)}h
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Avg Time
                    </div>
                  </div>
                </div>
              </div>

              {/* Workload Bar */}
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    overdueIntensity > 50 ? "bg-[#E07A5F]" : "bg-brand-teal"
                  )}
                  style={{ width: `${workloadIntensity}%` }}
                />
              </div>

              {/* Workload Status Badge */}
              {workloadIntensity > 80 && (
                <Badge
                  variant="outline"
                  className="absolute top-2 right-2 text-[10px] bg-white border-[#E07A5F] text-[#E07A5F]"
                >
                  High Load
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-brand-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-brand-teal/50 to-brand-teal/20" />
          <span>Workload intensity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-2 border-[#E07A5F]" />
          <span>Has overdue issues</span>
        </div>
      </div>
    </Card>
  );
}
