'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Moon, 
  X, 
  Clock, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Handoff, Issue } from '@/types/care-coordination';

interface HandoffBannerProps {
  className?: string;
  onIssueClick?: (issue: Issue) => void;
}

export function HandoffBanner({ className, onIssueClick }: HandoffBannerProps) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [taggedIssues, setTaggedIssues] = useState<Issue[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActiveHandoff();
  }, []);

  const fetchActiveHandoff = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/handoffs/active');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setHandoff(data.handoff);
          setTaggedIssues(data.taggedIssues || []);
        }
      } else {
        // Silently fail - no active handoff is normal
        setHandoff(null);
        setTaggedIssues([]);
      }
    } catch (error) {
      // Network errors are expected in some environments - fail silently
      setHandoff(null);
      setTaggedIssues([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !handoff || isDismissed) {
    return null;
  }

  const statusColors = {
    open: 'border-l-[#2D7A7A]',
    in_progress: 'border-l-blue-500',
    overdue: 'border-l-[#E07A5F]',
    resolved: 'border-l-[#81B29A]',
  };

  const isOverdue = (issue: Issue) => {
    const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince > 24 && issue.status !== 'resolved';
  };

  return (
    <Card className={cn(
      'bg-gradient-to-r from-brand-teal/5 via-brand-teal/8 to-brand-teal/5 border-2 border-brand-teal/40 overflow-hidden shadow-card animate-fade-in-up',
      className
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-5 cursor-pointer bg-gradient-to-r from-transparent to-brand-teal/5 touch-manipulation"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-[#2D7A7A] animate-pulse">
            <Moon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#1A1A1A] text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                🌙 Active After-Hours Handoff
              </h3>
              <Badge className="text-xs bg-[#2D7A7A] text-white border-0 animate-pulse">
                {taggedIssues.length} issues
              </Badge>
            </div>
            <p className="text-sm text-[#1A1A1A] flex items-center gap-2 mt-1 font-medium">
              <Clock className="w-4 h-4 text-[#2D7A7A]" />
              {format(new Date(handoff.shift_start), 'MMM d, h:mm a')} — {format(new Date(handoff.shift_end), 'h:mm a')}
              <span className="text-[#2D7A7A]">
                (ends {formatDistanceToNow(new Date(handoff.shift_end), { addSuffix: true })})
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t-2 border-[#2D7A7A]/20 p-5 pt-4 space-y-4 animate-in fade-in duration-200 bg-white/80">
          {/* Priority Banner for After Hours Team */}
          <div className="p-3 bg-[#2D7A7A]/10 border-l-4 border-[#2D7A7A] rounded-lg">
            <p className="text-sm font-medium text-[#1A1A1A]">
              ⚠️ You are receiving this shift. Review tagged issues and handoff notes carefully.
            </p>
          </div>

          {/* Notes */}
          {handoff.notes && (
            <div className="p-4 bg-white rounded-lg border-2 border-[#2D7A7A]/20 shadow-sm">
              <p className="text-xs font-bold text-[#2D7A7A] mb-2 uppercase tracking-wide flex items-center gap-2">
                📋 Coordinator Notes
              </p>
              <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap leading-relaxed">
                {handoff.notes}
              </p>
              {handoff.creator && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t flex items-center gap-1">
                  <User className="w-3 h-3" />
                  From {handoff.creator.name || handoff.creator.email?.split('@')[0] || 'Coordinator'}
                </p>
              )}
            </div>
          )}

          {/* Tagged Issues */}
          {taggedIssues.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide flex items-center gap-2">
                  🔖 Priority Issues ({taggedIssues.length})
                </p>
                <Badge variant="outline" className="text-xs">
                  Click to view details
                </Badge>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2">{taggedIssues.map((issue) => {
                    const overdue = isOverdue(issue);
                    return (
                      <div
                        key={issue.id}
                        onClick={() => onIssueClick?.(issue)}
                        className={cn(
                          'flex items-center justify-between p-4 rounded-lg border-l-4 bg-white border-2 border-[#D4D4D4] transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]',
                          overdue ? statusColors.overdue : statusColors[issue.status as keyof typeof statusColors]
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{issue.issue_number}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {issue.issue_type}
                            </Badge>
                            {overdue && (
                              <AlertCircle className="w-3 h-3 text-[#E07A5F]" />
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {issue.patient?.first_name} {issue.patient?.last_name}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
