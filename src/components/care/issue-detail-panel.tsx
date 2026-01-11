'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, CheckCircle2, UserCircle, History, FileText, Users, AlertTriangle, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Issue } from '@/types/care-coordination';

interface IssueDetailPanelProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (issueId: string) => void;
  onAssign: (issueId: string, userId: string) => void;
  onStatusChange?: (issueId: string, status: string, note?: string) => Promise<void>;
  onAddUpdate?: (issueId: string, note: string) => void;
  currentUserId: string;
  userRole: string;
  availableUsers?: Array<{ id: string; email?: string; name?: string }>;
  slug?: string;
}

export function IssueDetailPanel({
  issue,
  open,
  onOpenChange,
  onResolve,
  onAssign,
  onStatusChange,
  onAddUpdate,
  currentUserId,
  userRole,
  availableUsers = [],
  slug
}: IssueDetailPanelProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState('');
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [patientConversationId, setPatientConversationId] = useState<string | null>(null);
  const [localLastActivityAt, setLocalLastActivityAt] = useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [localAcknowledged, setLocalAcknowledged] = useState<{ at: string; by: string } | null>(null);

  // Use local status if set, otherwise use issue status
  const currentStatus = localStatus || issue?.status;

  // Reset local state when issue changes or when issue status is updated from parent
  useEffect(() => {
    setLocalStatus(null);
    setLocalLastActivityAt(null);
    setLocalAcknowledged(null);
  }, [issue?.id, issue?.status]);

  // Clear form fields when the sheet closes
  useEffect(() => {
    if (!open) {
      setUpdateNote('');
    }
  }, [open]);

  useEffect(() => {
    if (issue?.id) {
      fetchAuditHistory();
      fetchPatientConversation();
      // Set the selected user to current assignee when issue changes
      if (issue.assigned_to) {
        setSelectedUser(issue.assigned_to);
      } else {
        setSelectedUser('');
      }
    }
  }, [issue?.id, issue?.assigned_to]);

  const fetchPatientConversation = async () => {
    if (!issue?.patient_id) return;

    try {
      const response = await fetch(`/api/conversations/by-patient/${issue.patient_id}`);
      if (response.ok) {
        const data = await response.json();
        setPatientConversationId(data.conversation?.id || null);
      } else {
        setPatientConversationId(null);
      }
    } catch (error) {
      console.error('Error fetching patient conversation:', error);
      setPatientConversationId(null);
    }
  };

  const handleOpenPatientMessage = () => {
    if (patientConversationId && slug) {
      router.push(`/${slug}/dashboard/messages?conversation=${patientConversationId}`);
      onOpenChange(false);
    }
  };

  const handleAssign = async () => {
    if (!issue || !selectedUser) return;
    
    onAssign(issue.id, selectedUser);
    setSelectedUser('');
    toast.success('Issue reassigned');
    // Refresh audit history after assignment
    setTimeout(() => fetchAuditHistory(), 500);
  };

  const fetchAuditHistory = async () => {
    if (!issue) return;
    
    setIsLoadingAudit(true);
    try {
      const response = await fetch(`/api/audit-log?issueId=${issue.id}`);
      const data = await response.json();
      setAuditHistory(data);
    } catch (error) {
      console.error('Error fetching audit history:', error);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const formatAuditAction = (action: string, details: any, assignedToUser?: { name?: string; email?: string }) => {
    switch (action) {
      case 'created':
        return 'Issue created';
      case 'assigned':
        const assigneeName = assignedToUser?.name || assignedToUser?.email?.split('@')[0] || details?.assigned_to_name || 'user';
        return `Reassigned to ${assigneeName}`;
      case 'status_changed':
        return `Status: ${details?.old_status?.replace('_', ' ')} → ${details?.new_status?.replace('_', ' ')}`;
      case 'resolved':
        return 'Marked as resolved';
      case 'updated':
        return 'Added update note';
      case 'acknowledged':
        return 'Issue acknowledged';
      case 'lifecycle_completed':
        return `Total Lifecycle: ${details?.total_lifecycle}`;
      default:
        return action;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!issue) return;
    
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus, 
          note: updateNote.trim() || undefined 
        })
      });

      if (response.ok) {
        // Update local status immediately for real-time feedback
        setLocalStatus(newStatus);
        setUpdateNote('');
        toast.success('Status updated', {
          description: `Issue moved to ${newStatus.replace('_', ' ')}`
        });
        fetchAuditHistory();
        if (onStatusChange) {
          await onStatusChange(issue.id, newStatus, updateNote.trim() || undefined);
        }
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!issue || !updateNote.trim()) return;

    try {
      const response = await fetch(`/api/issues/${issue.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: updateNote.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        // Update local last_activity_at to immediately reflect overdue reset
        if (data.last_activity_at) {
          setLocalLastActivityAt(data.last_activity_at);
        }
        setUpdateNote('');
        toast.success('Update added');
        fetchAuditHistory();
        if (onAddUpdate) {
          await onAddUpdate(issue.id, updateNote.trim());
        }
      } else {
        toast.error('Failed to add update');
      }
    } catch (error) {
      toast.error('Failed to add update');
    }
  };

  const handleResolveConfirm = () => {
    if (!issue) return;
    onResolve(issue.id);
    setShowResolveDialog(false);
    onOpenChange(false);
  };

  const handleAcknowledge = async () => {
    if (!issue) return;

    setIsAcknowledging(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setLocalAcknowledged({
          at: data.acknowledged_at,
          by: data.acknowledged_by
        });
        toast.success('Issue acknowledged', {
          description: 'Your acknowledgement has been recorded'
        });
        fetchAuditHistory();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to acknowledge issue');
      }
    } catch (error) {
      toast.error('Failed to acknowledge issue');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'in_progress':
        return 'hsl(var(--status-open))';
      case 'overdue':
        return 'hsl(var(--status-overdue))';
      case 'resolved':
        return 'hsl(var(--status-resolved))';
      default:
        return 'hsl(var(--muted))';
    }
  };

  if (!issue) return null;

  const isOverdue = () => {
    if (currentStatus === 'resolved') return false;
    // Use local last_activity_at first (from recent update), then issue prop, then created_at
    const lastActivity = new Date(localLastActivityAt || issue.last_activity_at || issue.created_at);
    const hoursSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  };

  const statusColor = getStatusColor(isOverdue() ? 'overdue' : (currentStatus || 'open'));
  const canResolve = currentStatus !== 'resolved' && (issue.assigned_to === currentUserId || userRole === 'coordinator');
  const canAssign = userRole === 'coordinator';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl p-0 flex flex-col" side="right">
        <SheetHeader className="p-6 pb-4 pr-12">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono text-muted-foreground">
                  Issue #{issue.issue_number}
                </span>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: `${statusColor}15`,
                    color: statusColor,
                    borderColor: statusColor
                  }}
                >
                  {issue.issue_type}
                </Badge>
              </div>
              <SheetTitle className="text-2xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {issue.patient?.first_name} {issue.patient?.last_name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                MRN: {issue.patient?.mrn}
              </p>
              {/* Acknowledgement Status */}
              {(localAcknowledged || issue.acknowledged_at) ? (
                <div className="flex items-center gap-1.5 mt-2 text-[#81B29A]">
                  <CheckCheck className="w-4 h-4" />
                  <span className="text-sm font-medium">Acknowledged</span>
                </div>
              ) : (
                issue.assigned_to === currentUserId && currentStatus !== 'resolved' && (
                  <div className="flex items-center gap-1.5 mt-2 text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Acknowledgement Required</span>
                  </div>
                )
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={isOverdue() ? 'destructive' : 'outline'}>
                {isOverdue() ? 'OVERDUE' : (currentStatus || 'open').toUpperCase().replace(/_/g, ' ')}
              </Badge>
              <Dialog open={showTimelineModal} onOpenChange={setShowTimelineModal}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-2" title="View Activity Timeline">
                    <History className="w-4 h-4" />
                    <span className="text-xs">Activity Timeline</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Activity Timeline ({auditHistory.length})
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh] pr-4">
                    {isLoadingAudit ? (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        Loading timeline...
                      </div>
                    ) : auditHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No activity recorded
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {auditHistory.map((entry) => (
                          <div key={entry.id} className="flex gap-3 text-sm">
                            <div className="w-1 bg-[#D4D4D4] rounded-full flex-shrink-0" />
                            <div className="flex-1 pb-3">
                              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                                <span className="font-medium text-[#1A1A1A]">
                                  {formatAuditAction(entry.action, entry.details, entry.assigned_to_user)}
                                </span>
                                <span className="text-xs text-[#999] font-mono">
                                  {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                                </span>
                              </div>
                              <p className="text-xs text-[#666]">
                                by {entry.user?.name || entry.user?.email?.split('@')[0] || 'Unknown User'}
                              </p>
                              {entry.action === 'updated' && entry.details?.note && (
                                <p className="text-sm text-[#333] mt-2 bg-[#F5F5F5] rounded p-2">
                                  "{entry.details.note}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
              {patientConversationId && slug && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 text-[#2D7A7A] hover:text-[#236060] hover:bg-[#2D7A7A]/10"
                  onClick={handleOpenPatientMessage}
                >
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Patient Group Message</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Acknowledgement Required Banner */}
        {!localAcknowledged && !issue.acknowledged_at && issue.assigned_to === currentUserId && currentStatus !== 'resolved' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 text-sm">Acknowledgement Required</h4>
                <p className="text-sm text-amber-700 mt-1">
                  This issue has been assigned to you. Please acknowledge that you have reviewed it.
                </p>
                <Button
                  onClick={handleAcknowledge}
                  disabled={isAcknowledging}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  {isAcknowledging ? 'Acknowledging...' : 'Acknowledge Issue'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Issue Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Reported By</p>
                  <p className="font-medium">{issue.reporter?.email?.split('@')[0] || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Reported</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Priority</p>
                  <Badge variant="outline" className="capitalize">
                    {issue.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Assigned To</p>
                  <p className="font-medium">
                    {issue.assignee?.name || issue.assignee?.email?.split('@')[0] || 'Unassigned'}
                  </p>
                </div>
              </div>

              {issue.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{issue.description}</p>
                </div>
              )}

              {issue.tags && issue.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {issue.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Update Notes Display */}
            {(() => {
              const updateNotes = auditHistory.filter((entry) => entry.action === 'updated' && entry.details?.note);
              return updateNotes.length > 0 ? (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Update Notes ({updateNotes.length})
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {updateNotes.map((entry) => (
                        <div key={entry.id} className="bg-[#FAFAF8] border border-[#D4D4D4] rounded-lg p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs bg-[#2D7A7A]/10 text-[#2D7A7A]">
                                  {entry.user?.name?.[0] || entry.user?.email?.[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-[#1A1A1A]">
                                {entry.user?.name || entry.user?.email?.split('@')[0] || 'Unknown'}
                              </span>
                            </div>
                            <span className="text-xs text-[#999] font-mono">
                              {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-[#333]">{entry.details.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              ) : null;
            })()}

            {/* Add Update Note */}
            {currentStatus !== 'resolved' && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Add Update Note
                  </h3>
                  <Textarea
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Add a progress update, note, or additional context..."
                    rows={3}
                    className="resize-none border-[#D4D4D4]"
                  />
                  <Button
                    onClick={handleAddUpdate}
                    disabled={!updateNote.trim()}
                    variant="outline"
                    className="w-full"
                  >
                    Add Update
                  </Button>
                </div>
                <Separator />
              </>
            )}

          </div>
        </ScrollArea>

        <Separator />

        <div className="p-6 pt-4 space-y-4">
          {/* Assignment */}
          {canAssign && currentStatus !== 'resolved' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Assign Issue
              </h3>
              <div className="flex gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="flex-1 border-[#D4D4D4]">
                    <SelectValue placeholder="Select clinician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email?.split('@')[0] || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedUser}
                  className="bg-[#2D7A7A] hover:bg-[#236060]"
                >
                  Assign
                </Button>
              </div>
            </div>
          )}

          {canResolve && currentStatus !== 'resolved' && (
            <div className="flex gap-3">
              {/* Resolve Button */}
              <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    className="flex-1 bg-[#81B29A] hover:bg-[#6a9982] text-white"
                    size="lg"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resolve Issue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark issue #{issue.issue_number} as resolved and remove it from the active queue.
                      The issue will be archived and included in reporting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResolveConfirm}
                      className="bg-[#81B29A] hover:bg-[#6a9982]"
                    >
                      Confirm Resolution
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
