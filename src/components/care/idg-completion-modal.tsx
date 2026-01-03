'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Users, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface IDGCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (disciplinesPresent: string[]) => Promise<void>;
  weekStart: string;
  weekEnd: string;
  disciplines: string[];
  issueCount: number;
  admissionsCount: number;
  deathsCount: number;
  previousReview?: {
    completed_at: string;
    disciplines_present: string[];
    total_issues_reviewed: number;
  } | null;
}

export function IDGCompletionModal({
  open,
  onOpenChange,
  onComplete,
  weekStart,
  weekEnd,
  disciplines,
  issueCount,
  admissionsCount,
  deathsCount,
  previousReview
}: IDGCompletionModalProps) {
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDisciplineToggle = (discipline: string) => {
    setSelectedDisciplines(prev =>
      prev.includes(discipline)
        ? prev.filter(d => d !== discipline)
        : [...prev, discipline]
    );
  };

  const handleComplete = async () => {
    if (selectedDisciplines.length === 0) return;

    setIsSubmitting(true);
    try {
      await onComplete(selectedDisciplines);
      onOpenChange(false);
      setSelectedDisciplines([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatWeekRange = () => {
    return `${format(new Date(weekStart), 'MMM d')} - ${format(new Date(weekEnd), 'MMM d, yyyy')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#2D7A7A]" />
            Complete IDG Review
          </DialogTitle>
          <DialogDescription>
            Mark the IDG review as complete for {formatWeekRange()}
          </DialogDescription>
        </DialogHeader>

        {/* Previous Review Warning */}
        {previousReview && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">This week was already reviewed</p>
              <p className="text-amber-700 text-xs mt-1">
                Completed on {format(new Date(previousReview.completed_at), 'MMM d, yyyy h:mm a')}
                {' '}with {previousReview.total_issues_reviewed} issues reviewed.
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-[#2D7A7A]" />
            <p className="text-xl font-bold">{issueCount}</p>
            <p className="text-xs text-muted-foreground">Issues</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xl font-bold">{admissionsCount}</p>
            <p className="text-xs text-muted-foreground">Admissions</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <span className="block text-xl mb-1">🕊️</span>
            <p className="text-xl font-bold">{deathsCount}</p>
            <p className="text-xs text-muted-foreground">Deaths</p>
          </div>
        </div>

        {/* Disciplines Present */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Disciplines Present at IDG
            </label>
            <span className="text-xs text-muted-foreground">
              {selectedDisciplines.length} selected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
            {disciplines.map((discipline) => (
              <div
                key={discipline}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Checkbox
                  id={discipline}
                  checked={selectedDisciplines.includes(discipline)}
                  onCheckedChange={() => handleDisciplineToggle(discipline)}
                />
                <label
                  htmlFor={discipline}
                  className="text-sm cursor-pointer flex-1"
                >
                  {discipline}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* What this captures */}
        <div className="bg-[#FAFAF8] rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">This will record:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Timestamp of completion</li>
            <li>Disciplines present</li>
            <li>Number of issues reviewed ({issueCount})</li>
          </ul>
          <p className="mt-2 italic">
            No signatures, attestations, or clinical notes are captured.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={selectedDisciplines.length === 0 || isSubmitting}
            className="bg-[#2D7A7A] hover:bg-[#236060]"
          >
            {isSubmitting ? 'Completing...' : 'IDG Review Completed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
