'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientAutocomplete } from './patient-autocomplete';
import { Plus, X, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Patient } from '@/types/care-coordination';
import { ISSUE_TYPES, TIMESTAMPED_ISSUE_TYPES } from '@/types/care-coordination';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickReportModalProps {
  userId: string;
  userRole?: string;
  onSuccess?: (issue: any) => void;
  externalTrigger?: () => void;
  onExternalTriggerSet?: (trigger: () => void) => void;
}

export function QuickReportModal({ userId, userRole = 'clinician', onSuccess, onExternalTriggerSet }: QuickReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Expose the setIsOpen function to parent components
  useEffect(() => {
    if (onExternalTriggerSet) {
      onExternalTriggerSet(() => setIsOpen(true));
    }
  }, [onExternalTriggerSet]);

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
                userRole={userRole}
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
              />
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Use Dialog */
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-2xl font-semibold">Quick Report</DialogTitle>
              <p className="text-sm text-[#666] mt-1">Create a new issue in under 60 seconds</p>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <QuickReportForm
                userId={userId}
                userRole={userRole}
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function QuickReportForm({
  userId,
  userRole = 'clinician',
  onSuccess,
  onCancel
}: {
  userId: string;
  userRole?: string;
  onSuccess: (issue: any) => void;
  onCancel: () => void;
}) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name?: string; email?: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>(userId);
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [eventTime, setEventTime] = useState('12:00');
  const [eventReason, setEventReason] = useState('');
  const [bereavementStatus, setBereavementStatus] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if current issue type requires a timestamp
  const requiresTimestamp = TIMESTAMPED_ISSUE_TYPES.includes(issueType as any);

  // Combine date and time into a timestamp
  const getEventTimestamp = () => {
    if (!eventDate || !requiresTimestamp) return null;
    const [hours, minutes] = eventTime.split(':').map(Number);
    const timestamp = new Date(eventDate);
    timestamp.setHours(hours, minutes, 0, 0);
    return timestamp.toISOString();
  };

  const isCoordinator = userRole === 'coordinator';

  // Fetch existing tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.tags || []);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  // Fetch available users for coordinators
  useEffect(() => {
    if (!isCoordinator) return;

    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setAvailableUsers(data.users || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, [isCoordinator]);

  // Filter tags based on input
  useEffect(() => {
    if (tagInput.trim()) {
      const currentTag = tagInput.toLowerCase().trim();
      const filtered = availableTags.filter(
        (tag) => 
          tag.toLowerCase().includes(currentTag) && 
          !selectedTags.includes(tag)
      );
      setFilteredTags(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setFilteredTags([]);
      setShowTagSuggestions(false);
    }
  }, [tagInput, availableTags, selectedTags]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(event.target as Node)
      ) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = useCallback((tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
      setSelectedTags((prev) => [...prev, normalizedTag]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  }, [selectedTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  }, []);

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === ',' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };


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

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmSubmit = async () => {
    if (!selectedPatient) return;

    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          reported_by: userId,
          assigned_to: selectedAssignee,
          issue_type: issueType,
          description: description || null,
          priority,
          tags: selectedTags.length > 0 ? selectedTags : null,
          event_timestamp: getEventTimestamp(),
          event_reason: requiresTimestamp && eventReason.trim() ? eventReason.trim() : null,
          bereavement_status: issueType === 'Death' && bereavementStatus ? bereavementStatus : null,
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
          className="w-full border border-[#D4D4D4] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D7A7A] bg-white transition-colors appearance-none cursor-pointer hover:border-[#999]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231A1A1A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '36px'
          }}
        >
          <option value="">Select issue type...</option>
          {ISSUE_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Date/Time picker for Admitted, Discharged, Death */}
      {requiresTimestamp && (
        <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              When did this {issueType.toLowerCase() === 'death' ? 'occur' : 'happen'}?
            </span>
          </div>
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal border-amber-300 bg-white",
                    !eventDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="w-32 border-amber-300 bg-white"
            />
          </div>

          {/* Reason textarea for Death/Discharged */}
          <div>
            <label className="text-sm font-medium text-amber-800 mb-2 block">
              {issueType === 'Death' ? 'Cause of Death' : 'Reason For Discharge'}
            </label>
            <Textarea
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value)}
              placeholder={issueType === 'Death'
                ? "Enter the cause of death..."
                : "Enter the reason for discharge..."}
              className="resize-none border-amber-300 bg-white"
              rows={3}
            />
          </div>

          {/* Bereavement Status - Death only */}
          {issueType === 'Death' && (
            <div>
              <label className="text-sm font-medium text-amber-800 mb-2 block">
                Bereavement Status
              </label>
              <select
                value={bereavementStatus}
                onChange={(e) => setBereavementStatus(e.target.value)}
                className="w-full border border-amber-300 px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D7A7A] bg-white transition-colors appearance-none cursor-pointer hover:border-amber-400"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231A1A1A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '36px'
                }}
              >
                <option value="">Select status...</option>
                <option value="Education Provided">Education Provided</option>
                <option value="Education Not Yet Provided">Education Not Yet Provided</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Priority
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full border border-[#D4D4D4] px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D7A7A] bg-white transition-colors appearance-none cursor-pointer hover:border-[#999]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231A1A1A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '36px'
          }}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Assign to dropdown - Coordinators only */}
      {isCoordinator && (
        <div>
          <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
            Assign To
          </label>
          <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
            <SelectTrigger className="w-full border-[#D4D4D4]">
              <SelectValue placeholder="Select assignee..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email?.split('@')[0] || 'Unknown'}
                  {user.id === userId && ' (You)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#999] mt-1">
            Issues are auto-assigned to the creator by default
          </p>
        </div>
      )}

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

      <div className="relative">
        <label className="text-sm font-medium text-[#1A1A1A] mb-2 block">
          Tags (Optional)
        </label>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-[#2D7A7A]/10 text-[#2D7A7A] hover:bg-[#2D7A7A]/20 cursor-pointer pr-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-[#E07A5F] focus:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        
        {/* Tag Input */}
        <div className="relative">
          <Input
            ref={tagInputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            onFocus={() => tagInput.trim() && filteredTags.length > 0 && setShowTagSuggestions(true)}
            placeholder={selectedTags.length > 0 ? "Add more tags..." : "Type to search or add tags..."}
            className="border-[#D4D4D4]"
          />
          
          {/* Tag Suggestions Dropdown */}
          {showTagSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D4] rounded-md shadow-lg max-h-40 overflow-y-auto"
            >
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAFAF8] focus:bg-[#FAFAF8] focus:outline-none transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <p className="text-xs text-[#999] mt-1">
          {availableTags.length > 0 
            ? "Start typing to see suggestions, or press Enter/comma to add a new tag"
            : "Press Enter or comma to add tags"}
        </p>
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Issue Creation
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-3">
              <p className="text-[#333]">
                You are about to create an issue for <strong>{selectedPatient?.first_name} {selectedPatient?.last_name}</strong>.
              </p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Resolution Timer Starts Immediately</p>
                  <p className="mt-1">
                    Once created, the 24-hour resolution timer will begin. Issues not resolved within 24 hours will be marked as overdue.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmSubmit}
              className="bg-[#2D7A7A] hover:bg-[#236060]"
            >
              Create Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
