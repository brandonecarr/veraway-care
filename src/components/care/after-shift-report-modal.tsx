'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Archive,
  ChevronDown,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Issue, Handoff } from '@/types/care-coordination';
import { useReportTemplates } from '@/hooks/use-report-templates';
import { ReportTemplatesDialog } from './report-templates-dialog';

interface AfterShiftReportModalProps {
  issues: Issue[];
  onSuccess?: () => void;
}

export function AfterShiftReportModal({ issues, onSuccess }: AfterShiftReportModalProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [activeReport, setActiveReport] = useState<(Handoff & { creator?: { name?: string; email?: string } }) | null>(null);
  const [isCheckingActive, setIsCheckingActive] = useState(false);
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  } = useReportTemplates();

  const handleSelectTemplate = useCallback((content: string) => {
    setNotes(content);
  }, []);

  const handleOpenManageTemplates = useCallback(() => {
    // Close dropdown first, then open dialog after a short delay
    // This prevents portal conflicts between DropdownMenu and Dialog
    setIsDropdownOpen(false);
    setTimeout(() => {
      setIsTemplatesDialogOpen(true);
    }, 100);
  }, []);

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

  const handleOpen = async () => {
    setIsCheckingActive(true);
    try {
      // Check if there's an active (non-archived) report
      const response = await fetch('/api/handoffs/active');
      if (response.ok) {
        const data = await response.json();
        if (data && data.handoff) {
          // There's an active report - show confirmation dialog
          setActiveReport(data.handoff);
          setShowArchiveConfirm(true);
          return;
        }
      }
      // No active report - proceed to open the form
      setSelectedIssueIds(overdueIssueIds);
      setOpen(true);
    } catch (error) {
      console.error('Error checking for active report:', error);
      // On error, allow opening anyway
      setSelectedIssueIds(overdueIssueIds);
      setOpen(true);
    } finally {
      setIsCheckingActive(false);
    }
  };

  const handleArchiveAndCreate = async () => {
    if (!activeReport) return;

    setIsCheckingActive(true);
    try {
      // Archive the existing report
      const response = await fetch(`/api/handoffs/${activeReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true })
      });

      if (!response.ok) {
        toast.error('Failed to archive previous report');
        return;
      }

      toast.success('Previous report archived');
      setShowArchiveConfirm(false);
      setActiveReport(null);

      // Now open the create form
      setSelectedIssueIds(overdueIssueIds);
      setOpen(true);
    } catch (error) {
      console.error('Error archiving report:', error);
      toast.error('Failed to archive previous report');
    } finally {
      setIsCheckingActive(false);
    }
  };

  const handleCancelArchive = () => {
    setShowArchiveConfirm(false);
    setActiveReport(null);
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
    <>
      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#2D7A7A]" />
              Active Report Exists
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                There is already an active After Shift Report
                {activeReport?.creator?.name && (
                  <span> created by <strong>{activeReport.creator.name}</strong></span>
                )}
                {activeReport?.creator?.email && !activeReport?.creator?.name && (
                  <span> created by <strong>{activeReport.creator.email.split('@')[0]}</strong></span>
                )}
                .
              </p>
              <p>
                To create a new report, you must first archive the previous one. Would you like to archive it now and create a new report?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelArchive} disabled={isCheckingActive}>
              No, Keep Current Report
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveAndCreate}
              disabled={isCheckingActive}
              className="bg-[#2D7A7A] hover:bg-[#236060]"
            >
              {isCheckingActive ? (
                'Archiving...'
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Yes, Archive and Create New
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trigger Button - separate from Dialog to control open state */}
      <Button
        variant="outline"
        className="gap-2 border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A]/10"
        onClick={handleOpen}
        disabled={isCheckingActive}
      >
        <FileText className="w-4 h-4" />
        {isCheckingActive ? 'Checking...' : 'After Shift Report'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          {/* Notes */}
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Report Notes</label>
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-[#D4D4D4]"
                  >
                    <FileText className="w-3 h-3" />
                    Templates
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {templates.length > 0 ? (
                    <>
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onSelect={() => handleSelectTemplate(template.content)}
                          className="cursor-pointer"
                        >
                          <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                          <span className="truncate">{template.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No templates yet
                    </div>
                  )}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleOpenManageTemplates();
                    }}
                    className="cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Templates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add important context for your team (e.g., pending callbacks, escalation concerns)..."
              rows={3}
              className="resize-none border-[#D4D4D4]"
            />
          </div>

          {/* Tag Issues */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <label className="text-sm font-medium">Tag Issues for Follow-up</label>
              <Badge variant="outline" className="text-xs">
                {selectedIssueIds.length} selected
              </Badge>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-[#D4D4D4]">
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
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
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

    {/* Report Templates Dialog */}
    <ReportTemplatesDialog
      open={isTemplatesDialogOpen}
      onOpenChange={setIsTemplatesDialogOpen}
      templates={templates}
      onAdd={addTemplate}
      onUpdate={updateTemplate}
      onDelete={deleteTemplate}
    />
    </>
  );
}
