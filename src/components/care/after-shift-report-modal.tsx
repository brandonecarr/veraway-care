'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Issue } from '@/types/care-coordination';

interface AfterShiftReportModalProps {
  issues: Issue[];
  onSuccess?: () => void;
}

export function AfterShiftReportModal({ issues, onSuccess }: AfterShiftReportModalProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter to show only open/in_progress issues
  const activeIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress');

  // Sort issues by priority and type
  const sortedIssues = useMemo(() => {
    const urgent = activeIssues.filter(i => i.priority === 'urgent');
    const high = activeIssues.filter(i => i.priority === 'high');
    const rest = activeIssues.filter(i => i.priority !== 'urgent' && i.priority !== 'high');

    // Group rest by issue_type, then sort by priority within each type
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
  }, [activeIssues]);

  // Pre-select overdue issues
  const overdueIssueIds = activeIssues
    .filter(issue => {
      const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
      return hoursSince > 24;
    })
    .map(i => i.id);

  const handleOpen = () => {
    setSelectedIssueIds(overdueIssueIds);
    setOpen(true);
  };

  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          tagged_issues: selectedIssueIds
        })
      });

      if (response.ok) {
        toast.success('After Shift Report submitted', {
          description: 'Your team has been notified'
        });
        setOpen(false);
        setNotes('');
        setSelectedIssueIds([]);
        onSuccess?.();
      } else {
        toast.error('Failed to submit report');
      }
    } catch (error) {
      console.error('Error creating after shift report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverdue = (issue: Issue) => {
    const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  };

  const renderIssueCard = (issue: Issue) => {
    const overdue = isOverdue(issue);
    return (
      <div
        key={issue.id}
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg bg-white border border-[#D4D4D4] transition-all',
          selectedIssueIds.includes(issue.id) && 'ring-2 ring-[#2D7A7A] ring-offset-1'
        )}
      >
        <Checkbox
          checked={selectedIssueIds.includes(issue.id)}
          onCheckedChange={() => toggleIssue(issue.id)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium truncate">
              {issue.patient?.first_name} {issue.patient?.last_name}
            </p>
            <Badge variant="secondary" className="text-xs shrink-0">
              {issue.issue_type}
            </Badge>
            {overdue && (
              <Badge variant="outline" className="text-xs bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F] shrink-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>
          {issue.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {issue.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A]/10"
          onClick={handleOpen}
        >
          <FileText className="w-4 h-4" />
          After Shift Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <FileText className="w-5 h-5 text-[#2D7A7A]" />
            After Shift Report
          </DialogTitle>
          <DialogDescription>
            Create a shift report for your team. Tag important issues and add context notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add important context for your team (e.g., pending callbacks, escalation concerns)..."
              rows={3}
              className="resize-none border-[#D4D4D4]"
            />
          </div>

          {/* Tag Issues */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tag Issues for Follow-up</label>
              <Badge variant="outline" className="text-xs">
                {selectedIssueIds.length} selected
              </Badge>
            </div>

            <ScrollArea className="h-[350px] rounded-md border border-[#D4D4D4]">
              <div className="p-3 space-y-4">
                {activeIssues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#81B29A]" />
                    No active issues to include in report
                  </div>
                ) : (
                  <>
                    {/* Urgent Issues */}
                    {sortedIssues.urgent.length > 0 && (
                      <Card className="p-4 bg-red-50 border-2 border-red-500">
                        <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Urgent Issues ({sortedIssues.urgent.length})
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
                          High Priority Issues ({sortedIssues.high.length})
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
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 bg-[#2D7A7A] hover:bg-[#236060]"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
