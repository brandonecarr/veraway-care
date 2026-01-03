'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Clock, User, MessageSquare, Activity, Stethoscope, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IDGIssue {
  id: string;
  issue_number: number;
  issue_type: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  assignee_name: string;
  assignee_job_role: string | null;
  hours_open: number;
  is_overdue: boolean;
  idg_reasons: string[];
  actions_taken?: any[];
  outstanding_next_steps?: any[];
  flagged_for_md_review?: boolean;
  idg_disposition?: string | null;
  reviewed_in_idg?: boolean;
}

interface IDGIssueCardProps {
  issue: IDGIssue;
  onClick?: () => void;
  onFlagForMD?: (issueId: string, flagged: boolean) => void;
  onDispositionChange?: (issueId: string, disposition: string) => void;
  dispositions?: { value: string; label: string }[];
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200'
};

const statusColors: Record<string, string> = {
  open: 'bg-[#2D7A7A]/10 text-[#2D7A7A]',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700'
};

const issueTypeColors: Record<string, string> = {
  'Change in Condition': '#2D7A7A',
  'Concern/Complaint': '#E07A5F',
  'Death': '#1A1A1A',
  'Infection': '#E07A5F',
  'Incident': '#E07A5F',
  'Unmanaged Pain': '#E07A5F',
  'Med Discrepancies': '#81B29A',
  'DME Malfunction': '#81B29A',
  'Missed/Declined Visit': '#F2CC8F',
  'Not Following Plan-of-Care': '#F2CC8F'
};

const dispositionColors: Record<string, string> = {
  monitoring_only: 'bg-blue-50 text-blue-700 border-blue-200',
  plan_in_place: 'bg-green-50 text-green-700 border-green-200',
  escalated: 'bg-red-50 text-red-700 border-red-200',
  pending_md_input: 'bg-purple-50 text-purple-700 border-purple-200',
  resolved: 'bg-gray-50 text-gray-700 border-gray-200'
};

export function IDGIssueCard({
  issue,
  onClick,
  onFlagForMD,
  onDispositionChange,
  dispositions = []
}: IDGIssueCardProps) {
  const formatHoursOpen = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const formatActions = (actions: any[]) => {
    if (!actions || actions.length === 0) return 'None documented';
    return actions
      .slice(0, 3)
      .map(a => {
        const actionLabel = a.action?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        return `${actionLabel} by ${a.user_name}`;
      })
      .join(', ');
  };

  const formatNextSteps = (steps: any[]) => {
    if (!steps || steps.length === 0) return 'None pending';
    const latestStep = steps[0];
    const message = latestStep.message || '';
    return message.length > 80 ? message.substring(0, 80) + '...' : message;
  };

  const handleFlagChange = (checked: boolean) => {
    if (onFlagForMD) {
      onFlagForMD(issue.id, checked);
    }
  };

  const handleDispositionChange = (value: string) => {
    if (onDispositionChange) {
      onDispositionChange(issue.id, value);
    }
  };

  return (
    <Card
      className={cn(
        'p-4 bg-white border-[#D4D4D4] hover:shadow-md transition-all',
        issue.is_overdue && 'border-l-4 border-l-red-500',
        issue.reviewed_in_idg && 'border-l-4 border-l-green-500'
      )}
    >
      <div className="space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex items-center gap-2 flex-wrap cursor-pointer flex-1"
            onClick={onClick}
          >
            <span className="font-mono text-sm text-muted-foreground">
              #{issue.issue_number}
            </span>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: issueTypeColors[issue.issue_type] || '#666' }}
            />
            <span className="font-medium text-sm">{issue.issue_type}</span>
            {issue.reviewed_in_idg && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Reviewed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className={priorityColors[issue.priority]}>
              {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
            </Badge>
            <Badge variant="secondary" className={statusColors[issue.status]}>
              {issue.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Meta Row */}
        <div
          className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground cursor-pointer"
          onClick={onClick}
        >
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {format(new Date(issue.created_at), 'MMM d, h:mm a')}
              <span className={cn(
                'ml-1',
                issue.is_overdue && 'text-red-600 font-medium'
              )}>
                ({formatHoursOpen(issue.hours_open)} open)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>
              {issue.assignee_job_role ? `${issue.assignee_job_role}: ` : ''}
              {issue.assignee_name}
            </span>
          </div>
        </div>

        {/* IDG Reason Badges */}
        <div onClick={onClick} className="cursor-pointer flex flex-wrap gap-1">
          {(issue.idg_reasons || []).map((reason, index) => (
            <Badge
              key={index}
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
            >
              {reason}
            </Badge>
          ))}
        </div>

        {/* Actions & Next Steps */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#D4D4D4] cursor-pointer"
          onClick={onClick}
        >
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
              <Activity className="w-3 h-3" />
              Actions Taken
            </div>
            <p className="text-xs text-[#666] line-clamp-2">
              {formatActions(issue.actions_taken || [])}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
              <MessageSquare className="w-3 h-3" />
              Outstanding Next Steps
            </div>
            <p className="text-xs text-[#666] line-clamp-2">
              {formatNextSteps(issue.outstanding_next_steps || [])}
            </p>
          </div>
        </div>

        {/* IDG Controls - Step 4: Coordinator preparation */}
        {(onFlagForMD || onDispositionChange) && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[#D4D4D4]">
            {/* MD Review Toggle */}
            {onFlagForMD && (
              <div className="flex items-center gap-2">
                <Switch
                  id={`md-review-${issue.id}`}
                  checked={issue.flagged_for_md_review || false}
                  onCheckedChange={handleFlagChange}
                  className="data-[state=checked]:bg-purple-600"
                />
                <label
                  htmlFor={`md-review-${issue.id}`}
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Stethoscope className="w-3 h-3" />
                  Flag for MD Review
                </label>
              </div>
            )}

            {/* Disposition Dropdown */}
            {onDispositionChange && dispositions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Disposition:</span>
                <Select
                  value={issue.idg_disposition || ''}
                  onValueChange={handleDispositionChange}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="Set disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show current disposition badge if set */}
            {issue.idg_disposition && (
              <Badge
                variant="outline"
                className={cn('text-xs', dispositionColors[issue.idg_disposition])}
              >
                {dispositions.find(d => d.value === issue.idg_disposition)?.label || issue.idg_disposition}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
