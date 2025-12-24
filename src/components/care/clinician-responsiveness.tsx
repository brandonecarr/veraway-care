'use client';

import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClinicianData {
  userId: string;
  name: string;
  email: string;
  avgResponseTime: number;
  issuesResolved: number;
  openIssues: number;
}

interface ClinicianResponsivenessProps {
  data: ClinicianData[];
  className?: string;
  onClinicianClick?: (userId: string) => void;
}

export function ClinicianResponsiveness({ 
  data, 
  className,
  onClinicianClick 
}: ClinicianResponsivenessProps) {
  if (!data || data.length === 0) {
    return null;
  }

  // Find max values for relative scaling
  const maxResolved = Math.max(...data.map(d => d.issuesResolved), 1);
  
  // Sort by issues resolved (most productive first)
  const sortedData = [...data].sort((a, b) => b.issuesResolved - a.issuesResolved).slice(0, 6);

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const getResponseTimeColor = (hours: number) => {
    if (hours <= 4) return 'text-brand-sage';
    if (hours <= 12) return 'text-brand-orange';
    return 'text-brand-coral';
  };

  return (
    <Card className={cn('p-6 shadow-card h-full', className)}>
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-brand-teal" />
        <h2 className="text-section-title font-display">
          Team Responsiveness
        </h2>
      </div>

      <div className="space-y-3 md:space-y-4">
        {sortedData.map((clinician, index) => {
          const progressPercent = (clinician.issuesResolved / maxResolved) * 100;
          
          return (
            <div
              key={clinician.userId}
              className={cn(
                'p-3 rounded-lg transition-all border border-transparent',
                onClinicianClick && 'cursor-pointer hover:bg-muted/50 hover:border-muted'
              )}
              onClick={() => onClinicianClick?.(clinician.userId)}
            >
              {/* Mobile: Stacked Layout */}
              <div className="md:hidden">
                {/* Top Row: Rank, Avatar, Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <span className={cn(
                      'text-xs font-bold',
                      index === 0 && 'text-[#2D7A7A]',
                      index > 0 && 'text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-[#2D7A7A]/10 text-[#2D7A7A] text-xs font-medium">
                      {clinician.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {clinician.name}
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-3">
                  <Progress value={progressPercent} className="h-2" />
                </div>
                
                {/* Stats Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[#81B29A]" />
                    <span className="text-sm font-medium">{clinician.issuesResolved}</span>
                    <span className="text-xs">resolved</span>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1.5',
                    getResponseTimeColor(clinician.avgResponseTime)
                  )}>
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium font-mono">
                      {clinician.avgResponseTime > 0 ? formatTime(clinician.avgResponseTime) : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">avg</span>
                  </div>
                  {clinician.openIssues > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {clinician.openIssues} open
                    </Badge>
                  )}
                </div>
              </div>

              {/* Desktop: Horizontal Layout */}
              <div className="hidden md:flex items-center gap-4">
                {/* Rank Badge */}
                <div className="w-6 text-center">
                  <span className={cn(
                    'text-sm font-bold',
                    index === 0 && 'text-[#2D7A7A]',
                    index > 0 && 'text-muted-foreground'
                  )}>
                    {index + 1}
                  </span>
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[#2D7A7A]/10 text-[#2D7A7A] text-sm font-medium">
                    {clinician.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {clinician.name}
                    </span>
                    {clinician.openIssues > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {clinician.openIssues} open
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1">
                    <Progress 
                      value={progressPercent} 
                      className="h-2"
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[#81B29A]" />
                    <span className="font-medium">{clinician.issuesResolved}</span>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1',
                    getResponseTimeColor(clinician.avgResponseTime)
                  )}>
                    <Clock className="w-4 h-4" />
                    <span className="font-medium font-mono">
                      {clinician.avgResponseTime > 0 ? formatTime(clinician.avgResponseTime) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t flex items-center justify-center gap-4 md:gap-6 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-[#81B29A]" />
          <span>Resolved</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Avg Response</span>
        </div>
      </div>
    </Card>
  );
}
