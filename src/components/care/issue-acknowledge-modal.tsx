'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CheckCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Issue } from '@/types/care-coordination';

interface IssueAcknowledgeModalProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledged: (issue: Issue) => void;
  onCancel: () => void;
}

export function IssueAcknowledgeModal({
  issue,
  open,
  onOpenChange,
  onAcknowledged,
  onCancel,
}: IssueAcknowledgeModalProps) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);

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
        toast.success('Issue acknowledged', {
          description: 'Your acknowledgement has been recorded'
        });
        // Pass updated issue with acknowledgement data
        onAcknowledged({
          ...issue,
          acknowledged_at: data.acknowledged_at,
          acknowledged_by: data.acknowledged_by
        });
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

  const handleClose = () => {
    // When user closes without acknowledging, call onCancel
    onCancel();
    onOpenChange(false);
  };

  if (!issue) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-xl">Acknowledgement Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-left space-y-3">
            <p>
              This issue has been assigned to you and requires your acknowledgement before you can view the details.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium text-foreground">
                Issue #{issue.issue_number}: {issue.issue_type}
              </p>
              <p className="text-sm">
                Patient: {issue.patient?.first_name} {issue.patient?.last_name}
              </p>
            </div>
            <p className="text-sm">
              By acknowledging, you confirm that you have been notified of this issue and will review it.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isAcknowledging}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            {isAcknowledging ? 'Acknowledging...' : 'Acknowledge Issue'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
