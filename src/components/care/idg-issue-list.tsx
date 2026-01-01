'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, User, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IDGIssueCard } from './idg-issue-card';

interface IDGIssue {
  id: string;
  issue_number: number;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  issue_type: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  assignee_name: string;
  assignee_job_role: string | null;
  hours_open: number;
  is_overdue: boolean;
  idg_reason: string;
  actions_taken?: any[];
  outstanding_next_steps?: any[];
}

interface PatientGroup {
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  issues: IDGIssue[];
}

interface IDGIssueListProps {
  issues: IDGIssue[];
  grouped: Record<string, any>;
  groupBy: 'patient' | 'issue_type';
  onIssueClick?: (issue: IDGIssue) => void;
}

export function IDGIssueList({ issues, grouped, groupBy, onIssueClick }: IDGIssueListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allKeys = Object.keys(grouped);
    setExpandedGroups(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (issues.length === 0) {
    return (
      <Card className="p-12 text-center bg-white">
        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">No issues for IDG review</p>
        <p className="text-sm text-muted-foreground mt-1">
          All issues are resolved or do not meet IDG criteria
        </p>
      </Card>
    );
  }

  const renderPatientGroup = (patientId: string, group: PatientGroup) => {
    // Ensure group.issues is an array (handles race condition when switching groupBy)
    const issuesList = Array.isArray(group?.issues) ? group.issues : [];
    const isExpanded = expandedGroups.has(patientId);
    const urgentCount = issuesList.filter(i => i.priority === 'urgent').length;
    const highCount = issuesList.filter(i => i.priority === 'high').length;
    const overdueCount = issuesList.filter(i => i.is_overdue).length;

    return (
      <Card key={patientId} className="overflow-hidden bg-white">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleGroup(patientId)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 rounded-full bg-[#2D7A7A]/10">
              <User className="w-5 h-5 text-[#2D7A7A]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">
                  {group?.patient_name || 'Unknown Patient'}
                </h3>
                <span className="text-sm text-muted-foreground font-mono">
                  MRN: {group?.patient_mrn || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {issuesList.length} {issuesList.length === 1 ? 'issue' : 'issues'}
                </Badge>
                {urgentCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 text-xs">
                    {urgentCount} urgent
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 text-xs">
                    {highCount} high
                  </Badge>
                )}
                {overdueCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {overdueCount} overdue
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-[#D4D4D4] p-4 bg-[#FAFAF8]/50 space-y-3">
            {issuesList.map(issue => (
              <IDGIssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onIssueClick?.(issue)}
              />
            ))}
          </div>
        )}
      </Card>
    );
  };

  const renderIssueTypeGroup = (issueType: string, typeIssues: IDGIssue[]) => {
    // Ensure typeIssues is an array
    const issuesList = Array.isArray(typeIssues) ? typeIssues : [];
    const isExpanded = expandedGroups.has(issueType);
    const urgentCount = issuesList.filter(i => i.priority === 'urgent').length;
    const highCount = issuesList.filter(i => i.priority === 'high').length;
    const overdueCount = issuesList.filter(i => i.is_overdue).length;

    const issueTypeColors: Record<string, string> = {
      'Change in Condition': 'bg-[#2D7A7A]/10 text-[#2D7A7A]',
      'Concern/Complaint': 'bg-[#E07A5F]/10 text-[#E07A5F]',
      'Death': 'bg-gray-100 text-gray-700',
      'Infection': 'bg-[#E07A5F]/10 text-[#E07A5F]',
      'Incident': 'bg-[#E07A5F]/10 text-[#E07A5F]',
      'Unmanaged Pain': 'bg-[#E07A5F]/10 text-[#E07A5F]',
      'Med Discrepancies': 'bg-[#81B29A]/10 text-[#81B29A]',
      'DME Malfunction': 'bg-[#81B29A]/10 text-[#81B29A]',
      'Missed/Declined Visit': 'bg-[#F2CC8F]/20 text-[#D4A855]',
      'Not Following Plan-of-Care': 'bg-[#F2CC8F]/20 text-[#D4A855]'
    };

    return (
      <Card key={issueType} className="overflow-hidden bg-white">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleGroup(issueType)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className={cn(
              "px-3 py-1.5 rounded-lg",
              issueTypeColors[issueType] || 'bg-gray-100 text-gray-700'
            )}>
              <span className="font-medium text-sm">{issueType}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {issuesList.length} {issuesList.length === 1 ? 'issue' : 'issues'}
              </Badge>
              {urgentCount > 0 && (
                <Badge className="bg-red-100 text-red-700 text-xs">
                  {urgentCount} urgent
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-100 text-orange-700 text-xs">
                  {highCount} high
                </Badge>
              )}
              {overdueCount > 0 && (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {overdueCount} overdue
                </Badge>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-[#D4D4D4] p-4 bg-[#FAFAF8]/50 space-y-3">
            {issuesList.map(issue => (
              <IDGIssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onIssueClick?.(issue)}
              />
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Expand/Collapse Controls */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={expandAll}
          className="text-sm text-[#2D7A7A] hover:underline"
        >
          Expand All
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          onClick={collapseAll}
          className="text-sm text-[#2D7A7A] hover:underline"
        >
          Collapse All
        </button>
      </div>

      {/* Grouped List */}
      <div className="space-y-3">
        {groupBy === 'patient' ? (
          Object.entries(grouped as Record<string, PatientGroup>).map(([patientId, group]) =>
            renderPatientGroup(patientId, group)
          )
        ) : (
          Object.entries(grouped as Record<string, IDGIssue[]>).map(([issueType, typeIssues]) =>
            renderIssueTypeGroup(issueType, typeIssues)
          )
        )}
      </div>
    </div>
  );
}
