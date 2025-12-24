'use client';

import { useState } from 'react';
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
  Moon, 
  Clock, 
  Send, 
  AlertCircle,
  CheckCircle2 
} from 'lucide-react';
import { format, addHours, addDays, startOfTomorrow, setHours } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Issue } from '@/types/care-coordination';

interface HandoffModalProps {
  issues: Issue[];
  onSuccess?: () => void;
}

export function HandoffModal({ issues, onSuccess }: HandoffModalProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftStart, setShiftStart] = useState<Date>(setHours(new Date(), 17)); // 5 PM default
  const [shiftEnd, setShiftEnd] = useState<Date>(setHours(addDays(new Date(), 1), 8)); // 8 AM next day

  // Filter to show only open/in_progress issues
  const activeIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress');
  
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
          shift_start: shiftStart.toISOString(),
          shift_end: shiftEnd.toISOString(),
          notes,
          tagged_issues: selectedIssueIds
        })
      });

      if (response.ok) {
        toast.success('Handoff created successfully', {
          description: 'After-hours team has been notified'
        });
        setOpen(false);
        setNotes('');
        setSelectedIssueIds([]);
        onSuccess?.();
      } else {
        toast.error('Failed to create handoff');
      }
    } catch (error) {
      console.error('Error creating handoff:', error);
      toast.error('Failed to create handoff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors = {
    open: 'border-l-[#2D7A7A]',
    in_progress: 'border-l-blue-500',
    overdue: 'border-l-[#E07A5F]',
  };

  const isOverdue = (issue: Issue) => {
    const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A]/10"
          onClick={handleOpen}
        >
          <Moon className="w-4 h-4" />
          Create Handoff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <Moon className="w-5 h-5 text-[#2D7A7A]" />
            After-Hours Handoff
          </DialogTitle>
          <DialogDescription>
            Create a shift handoff report for the after-hours team. Tag important issues and add context notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Shift Window Selection */}
          <Card className="p-4 bg-[#FAFAF8] border-[#D4D4D4]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium">Shift Coverage</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start Time</label>
                  <input
                    type="datetime-local"
                    value={format(shiftStart, "yyyy-MM-dd'T'HH:mm")}
                    onChange={(e) => setShiftStart(new Date(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D7A7A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">End Time</label>
                  <input
                    type="datetime-local"
                    value={format(shiftEnd, "yyyy-MM-dd'T'HH:mm")}
                    onChange={(e) => setShiftEnd(new Date(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#D4D4D4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D7A7A]"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    setShiftStart(setHours(now, 17));
                    setShiftEnd(setHours(addDays(now, 1), 8));
                  }}
                  className="text-xs"
                >
                  Evening Shift (5 PM - 8 AM)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    setShiftStart(setHours(now, 22));
                    setShiftEnd(setHours(addDays(now, 1), 7));
                  }}
                  className="text-xs"
                >
                  Night Shift (10 PM - 7 AM)
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Duration: {Math.round((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60))} hours
              </p>
            </div>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Handoff Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add important context for the after-hours team (e.g., pending callbacks, escalation concerns)..."
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
            
            <ScrollArea className="h-[200px] rounded-md border border-[#D4D4D4]">
              <div className="p-2 space-y-2">
                {activeIssues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#81B29A]" />
                    No active issues to hand off
                  </div>
                ) : (
                  activeIssues.map((issue) => {
                    const overdue = isOverdue(issue);
                    return (
                      <div
                        key={issue.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border-l-4 bg-white border border-[#D4D4D4] transition-all',
                          overdue ? statusColors.overdue : statusColors[issue.status as keyof typeof statusColors],
                          selectedIssueIds.includes(issue.id) && 'ring-2 ring-[#2D7A7A] ring-offset-1'
                        )}
                      >
                        <Checkbox
                          checked={selectedIssueIds.includes(issue.id)}
                          onCheckedChange={() => toggleIssue(issue.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{issue.issue_number}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {issue.issue_type}
                            </Badge>
                            {overdue && (
                              <Badge variant="outline" className="text-xs bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1 truncate">
                            {issue.patient?.first_name} {issue.patient?.last_name}
                          </p>
                          {issue.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {issue.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
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
            {isSubmitting ? 'Creating...' : 'Create Handoff'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
