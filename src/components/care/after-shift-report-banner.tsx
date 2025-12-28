'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  X,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Handoff, Issue } from '@/types/care-coordination';

interface AfterShiftReportBannerProps {
  className?: string;
  onIssueClick?: (issue: Issue) => void;
}

export function AfterShiftReportBanner({ className, onIssueClick }: AfterShiftReportBannerProps) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [taggedIssues, setTaggedIssues] = useState<Issue[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActiveReport();
  }, []);

  const fetchActiveReport = async () => {
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
        setHandoff(null);
        setTaggedIssues([]);
      }
    } catch (error) {
      setHandoff(null);
      setTaggedIssues([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Sort issues by priority
  const sortedIssues = useMemo(() => {
    const urgent = taggedIssues.filter(i => i.priority === 'urgent');
    const high = taggedIssues.filter(i => i.priority === 'high');
    const rest = taggedIssues.filter(i => i.priority !== 'urgent' && i.priority !== 'high');

    // Group rest by issue_type
    const groupedByType: Record<string, Issue[]> = {};
    rest.forEach(issue => {
      if (!groupedByType[issue.issue_type]) {
        groupedByType[issue.issue_type] = [];
      }
      groupedByType[issue.issue_type].push(issue);
    });

    // Sort each group: normal before low
    Object.keys(groupedByType).forEach(type => {
      groupedByType[type].sort((a, b) => {
        const priorityOrder: Record<string, number> = { normal: 0, low: 1 };
        return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
      });
    });

    return { urgent, high, groupedByType };
  }, [taggedIssues]);

  if (isLoading || !handoff || isDismissed) {
    return null;
  }

  const isOverdue = (issue: Issue) => {
    const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince > 24 && issue.status !== 'resolved';
  };

  const renderIssueCard = (issue: Issue) => {
    const overdue = isOverdue(issue);
    return (
      <div
        key={issue.id}
        onClick={() => onIssueClick?.(issue)}
        className="flex items-center justify-between p-3 rounded-lg bg-white border-2 border-[#D4D4D4] transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {issue.patient?.first_name} {issue.patient?.last_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {issue.issue_type}
            </Badge>
            {overdue && (
              <AlertCircle className="w-3 h-3 text-[#E07A5F]" />
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {issue.status.replace('_', ' ')}
        </Badge>
      </div>
    );
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
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#1A1A1A] text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Active After Shift Report
              </h3>
              <Badge className="text-xs bg-[#2D7A7A] text-white border-0 animate-pulse">
                {taggedIssues.length} issues
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}
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
          {/* Priority Banner */}
          <div className="p-3 bg-[#2D7A7A]/10 border-l-4 border-[#2D7A7A] rounded-lg">
            <p className="text-sm font-medium text-[#1A1A1A]">
              Review tagged issues and notes carefully before continuing your shift.
            </p>
          </div>

          {/* Notes */}
          {handoff.notes && (
            <div className="p-4 bg-white rounded-lg border-2 border-[#2D7A7A]/20 shadow-sm">
              <p className="text-xs font-bold text-[#2D7A7A] mb-2 uppercase tracking-wide flex items-center gap-2">
                Report Notes
              </p>
              <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap leading-relaxed">
                {handoff.notes}
              </p>
              {handoff.creator && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t flex items-center gap-1">
                  <User className="w-3 h-3" />
                  From {handoff.creator.name || handoff.creator.email?.split('@')[0] || 'Team Member'}
                </p>
              )}
            </div>
          )}

          {/* Tagged Issues */}
          {taggedIssues.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide flex items-center gap-2">
                  Tagged Issues ({taggedIssues.length})
                </p>
                <Badge variant="outline" className="text-xs">
                  Click to view details
                </Badge>
              </div>
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-4">
                  {/* Urgent Issues */}
                  {sortedIssues.urgent.length > 0 && (
                    <Card className="p-4 bg-red-50 border-2 border-red-500">
                      <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Urgent ({sortedIssues.urgent.length})
                      </h4>
                      <div className="space-y-2">
                        {sortedIssues.urgent.map(renderIssueCard)}
                      </div>
                    </Card>
                  )}

                  {/* High Priority Issues */}
                  {sortedIssues.high.length > 0 && (
                    <Card className="p-4 bg-orange-50 border-2 border-orange-500">
                      <h4 className="font-bold text-orange-700 mb-3 flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        High Priority ({sortedIssues.high.length})
                      </h4>
                      <div className="space-y-2">
                        {sortedIssues.high.map(renderIssueCard)}
                      </div>
                    </Card>
                  )}

                  {/* Issues by Type */}
                  {Object.entries(sortedIssues.groupedByType).map(([type, typeIssues]) => (
                    <div key={type}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">
                        {type} ({typeIssues.length})
                      </h4>
                      <div className="space-y-2">
                        {typeIssues.map(renderIssueCard)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
