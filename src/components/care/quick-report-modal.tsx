'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { PatientAutocomplete } from './patient-autocomplete';
import { Plus, X } from 'lucide-react';
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
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          reported_by: userId,
          issue_type: issueType,
          description: description || null,
          priority,
          tags: selectedTags.length > 0 ? selectedTags : null,
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
    </form>
  );
}
