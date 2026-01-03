"use client";

import { memo, useState } from "react";
import { Issue } from "@/types/care-coordination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, MessageSquare, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";

interface IssueCardProps {
  issue: Issue;
  onClick?: () => void;
  onMessageClick?: (e: React.MouseEvent) => void;
  onResolve?: () => void;
}

/**
 * IssueCard - Memoized to prevent re-renders when parent state changes
 * Only re-renders when issue data or callbacks change
 */
export const IssueCard = memo(function IssueCard({ issue, onClick, onMessageClick, onResolve }: IssueCardProps) {
  const isAnimatingOut = (issue as any)._isAnimatingOut;
  const [swipeOffset, setSwipeOffset] = useState(0);

  const swipeRef = useSwipeGesture({
    onSwipeRight: () => {
      if (issue.status !== 'resolved' && onResolve) {
        setSwipeOffset(100);
        setTimeout(() => {
          onResolve();
          setSwipeOffset(0);
        }, 200);
      }
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
      case "in_progress":
        return "hsl(var(--status-open))";
      case "overdue":
        return "hsl(var(--status-overdue))";
      case "resolved":
        return "hsl(var(--status-resolved))";
      default:
        return "hsl(var(--muted))";
    }
  };

  const isOverdue = () => {
    if (issue.status === "resolved") return false;
    const createdAt = new Date(issue.created_at);
    const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  };

  const statusColor = getStatusColor(isOverdue() ? "overdue" : issue.status);

  return (
    <div 
      ref={swipeRef} 
      className="relative"
      style={{ 
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset ? 'transform 0.2s ease-out' : 'none'
      }}
    >
      {swipeOffset > 0 && (
        <div className="absolute inset-0 bg-sage-green flex items-center justify-start px-6 rounded-md">
          <CheckCircle className="h-6 w-6 text-white" />
        </div>
      )}
      <Card
        onClick={onClick}
        className={cn(
          "relative overflow-hidden cursor-pointer",
          "shadow-card hover:shadow-card-hover hover-lift",
          "border-l-4 touch-manipulation select-none",
          "transition-all duration-200 ease-out",
          isAnimatingOut && "animate-resolve-exit",
        )}
        style={{ borderLeftColor: statusColor }}
        role="button"
        tabIndex={0}
        aria-label={`Issue ${issue.issue_number} for ${issue.patient?.first_name} ${issue.patient?.last_name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
      <div className="p-4 md:p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 w-[265px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-audit font-mono text-muted-foreground">
                #{issue.issue_number}
              </span>
              <Badge
                variant="secondary"
                className="text-xs font-medium"
                style={{
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                  borderColor: statusColor,
                }}
              >
                {issue.issue_type}
              </Badge>
            </div>
            <h3 className="text-card-header font-semibold text-foreground truncate font-space">
              {issue.patient?.first_name} {issue.patient?.last_name}
            </h3>
            <p className="text-body text-muted-foreground line-clamp-2 mt-1 min-h-[2.5rem]">
              {issue.description || '\u00A0'}
            </p>
          </div>
          <Badge
            variant={isOverdue() ? "destructive" : "outline"}
            className="text-xs shrink-0 w-[115px] flex items-center justify-center"
          >
            {isOverdue() ? "OVERDUE" : issue.status.toUpperCase().replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>
              {issue.assignee?.name ||
                issue.assignee?.email?.split("@")[0] ||
                "Unassigned"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {onMessageClick && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 md:h-6 px-3 md:px-2 text-muted-foreground hover:text-[#2D7A7A] hover:bg-[#2D7A7A]/10 active:scale-95 touch-manipulation"
                onClick={onMessageClick}
              >
                <MessageSquare className="w-4 h-4 md:w-3 md:h-3 mr-1" />
                <span className="hidden sm:inline">Message</span>
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                {formatDistanceToNow(new Date(issue.created_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
    </div>
  );
});
