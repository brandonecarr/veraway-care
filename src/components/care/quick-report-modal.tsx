'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PatientAutocomplete } from './patient-autocomplete';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Patient } from '@/types/care-coordination';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickReportModalProps {
  userId: string;
  onSuccess?: (issue: any) => void;
}

export function QuickReportModal({ userId, onSuccess }: QuickReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleSuccess = (issue: any) => {
    setIsOpen(false);
    onSuccess?.(issue);
  };

  return (
    <>
      {/* Floating Action Button - Fixed position with safe area padding for mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 h-14 w-14 md:h-16 md:w-16 rounded-full bg-brand-teal hover:bg-brand-teal/90 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[0.98] active:scale-95 flex items-center justify-center z-50 touch-manipulation"
        aria-label="Report new issue"
        style={{ 
          // Safe area for devices with notch/home indicator - applied to bottom position
          marginBottom: 'env(safe-area-inset-bottom, 0px)' 
        }}
      >
        <Plus className="h-7 w-7 md:h-8 md:w-8" />
      </button>

      {/* Mobile: Use Drawer (bottom sheet) */}
      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="h-[90vh] max-h-[90vh]">
            <DrawerHeader className="border-b pb-4">
              <DrawerTitle className="text-xl font-semibold">Quick Report</DrawerTitle>
              <p className="text-sm text-[#666] mt-1">Create a new issue in under 60 seconds</p>
            </DrawerHeader>
            <ScrollArea className="flex-1 px-4 pb-6">
              <QuickReportForm
                userId={userId}
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
              />
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Use Dialog */
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">Quick Report</DialogTitle>
              <p className="text-sm text-[#666] mt-1">Create a new issue in under 60 seconds</p>
            </DialogHeader>
            <QuickReportForm
              userId={userId}
              onSuccess={handleSuccess}
              onCancel={() => setIsOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function QuickReportForm({ 
  userId, 
  onSuccess, 
  onCancel 
}: { 
  userId: string; 
  onSuccess: (issue: any) => void; 
  onCancel: () => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const issueTypes = [
    'Change in Condition',
    'Concern/Complaint',
    'Death',
    'Infection',
    'Incident',
    'Unmanaged Pain',
    'Med Discrepancies',
    'DME Malfunction',
    'Missed/Declined Visit',
    'Not Following Plan-of-Care'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }

    setIsSubmitting(true);

    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          reported_by: userId,
          issue_type: issueType,
          description: description || null,
          priority,
          tags: tagArray.length > 0 ? tagArray : null,
        }),
      });

      if (response.ok) {
        const issue = await response.json();
        toast.success(`Issue #${issue.issue_number} created successfully`, {
          description: `${selectedPatient.last_name}, ${selectedPatient.first_name} - ${issueType}`,
        });
        onSuccess(issue);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create issue');
      }
    } catch (error) {
      console.error('Error creating issue:', error);
      toast.error('Failed to create issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Patient *
        </label>
        <PatientAutocomplete
          value={selectedPatient}
          onChange={setSelectedPatient}
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Issue Type *
        </label>
        <select
          required
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
          className="w-full rounded-md border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7A7A] bg-white"
        >
          <option value="">Select issue type...</option>
          {issueTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Priority
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded-md border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7A7A] bg-white"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Description (Optional)
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details about the issue..."
          className="resize-none border-[#D4D4D4]"
          rows={3}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Tags (Optional)
        </label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Separate tags with commas"
          className="border-[#D4D4D4]"
        />
        <p className="text-xs text-[#999] mt-1">Example: urgent, pain-management, follow-up</p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-[#2D7A7A] hover:bg-[#236060]"
        >
          {isSubmitting ? 'Submitting...' : 'Report Issue'}
        </Button>
      </div>
    </form>
  );
}
