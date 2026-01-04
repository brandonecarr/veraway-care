'use client';

import { useState, useEffect } from 'react';
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
import { FileText, Clock, Users, Calendar, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

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
  hours_open: number;
  is_overdue: boolean;
  idg_reasons: string[];
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  benefit_period: number | null;
  admission_date: string | null;
  status: string;
}

interface IDGIssueSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedIssueIds: string[], selectedPatientIds: string[]) => void;
  issues: IDGIssue[];
  fromDate: string;
  toDate: string;
  facilitySlug: string;
}

export function IDGIssueSelectionModal({
  open,
  onOpenChange,
  onConfirm,
  issues,
  fromDate,
  toDate,
  facilitySlug
}: IDGIssueSelectionModalProps) {
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [showCensus, setShowCensus] = useState(false);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIssueIds(new Set());
      setSelectedPatientIds(new Set());
      setShowCensus(false);
      setAllPatients([]); // Reset cached patients so they're fresh on next census toggle
    }
  }, [open]);

  // Fetch all patients when census is toggled on
  useEffect(() => {
    if (showCensus && facilitySlug) {
      fetchAllPatients();
    }
  }, [showCensus, facilitySlug]);

  const fetchAllPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const response = await fetch(`/api/patients?slug=${facilitySlug}&status=active`);
      if (response.ok) {
        const data = await response.json();
        setAllPatients(data.patients || []);
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  // Calculate days remaining in benefit period
  const calculateDaysRemaining = (patient: Patient): number | null => {
    if (!patient.benefit_period || !patient.admission_date) return null;

    const admissionDate = new Date(patient.admission_date);
    const today = new Date();
    const daysSinceAdmission = differenceInDays(today, admissionDate);

    // BP1-2: 90 days, BP3+: 60 days
    const periodLength = patient.benefit_period <= 2 ? 90 : 60;
    const daysRemaining = periodLength - daysSinceAdmission;

    return Math.max(0, daysRemaining);
  };

  const handleIssueToggle = (issueId: string) => {
    setSelectedIssueIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const handlePatientToggle = (patientId: string) => {
    setSelectedPatientIds(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIssueIds(new Set(issues.map(i => i.id)));
    if (showCensus) {
      // Select all patients when census is shown
      setSelectedPatientIds(new Set(allPatients.map(p => p.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedIssueIds(new Set());
    setSelectedPatientIds(new Set());
  };

  const handleConfirm = () => {
    if (selectedIssueIds.size === 0 && selectedPatientIds.size === 0) return;
    onConfirm(Array.from(selectedIssueIds), Array.from(selectedPatientIds));
    onOpenChange(false);
  };

  const totalSelectedCount = selectedIssueIds.size + selectedPatientIds.size;

  const formatDateRange = () => {
    return `${format(new Date(fromDate), 'MMM d')} - ${format(new Date(toDate), 'MMM d, yyyy')}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Group issues by patient
  const groupedByPatient = issues.reduce((acc, issue) => {
    if (!acc[issue.patient_id]) {
      acc[issue.patient_id] = {
        patient_name: issue.patient_name,
        patient_mrn: issue.patient_mrn,
        issues: []
      };
    }
    acc[issue.patient_id].issues.push(issue);
    return acc;
  }, {} as Record<string, { patient_name: string; patient_mrn: string; issues: IDGIssue[] }>);

  const patientGroups = Object.entries(groupedByPatient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2D7A7A]" />
            Select Issues for IDG Meeting
          </DialogTitle>
          <DialogDescription>
            Choose which issues to include in the IDG review for {formatDateRange()}
          </DialogDescription>
        </DialogHeader>

        {/* Selection Controls */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="text-sm text-muted-foreground">
            {issues.length} issues available{showCensus ? ` · ${allPatients.length} patients` : ''} · {totalSelectedCount} selected
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>
        </div>

        {/* Issue List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] -mx-6 px-6">
          {issues.length === 0 && !showCensus ? (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No issues found for this date range</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Try adjusting your date range or click &quot;Show Complete Census&quot; to see all patients
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Patients with issues */}
              {patientGroups.map(([patientId, group]) => (
                <div key={patientId} className="border rounded-lg overflow-hidden">
                  {/* Patient Header */}
                  <div className="bg-[#FAFAF8] px-4 py-2 flex items-center gap-2 border-b">
                    <Users className="w-4 h-4 text-[#2D7A7A]" />
                    <span className="font-medium">{group.patient_name}</span>
                    <span className="text-xs text-muted-foreground">MRN: {group.patient_mrn}</span>
                    <Badge variant="outline" className="ml-auto">
                      {group.issues.length} issue{group.issues.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {/* Issues under this patient */}
                  <div className="divide-y">
                    {group.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedIssueIds.has(issue.id) ? 'bg-[#2D7A7A]/5 ring-1 ring-[#2D7A7A] ring-inset' : ''
                        }`}
                        onClick={() => handleIssueToggle(issue.id)}
                      >
                        <Checkbox
                          checked={selectedIssueIds.has(issue.id)}
                          onCheckedChange={() => handleIssueToggle(issue.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{issue.issue_number}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {issue.issue_type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getPriorityColor(issue.priority)}`}
                            >
                              {issue.priority}
                            </Badge>
                            {issue.is_overdue && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                <Clock className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          {issue.description && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {issue.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>
                              Created {format(new Date(issue.created_at), 'MMM d, h:mm a')}
                            </span>
                            <span>&middot;</span>
                            <span className={issue.is_overdue ? 'text-red-600 font-medium' : ''}>
                              {issue.hours_open.toFixed(1)}h open
                            </span>
                          </div>
                          {issue.idg_reasons && issue.idg_reasons.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">Reason:</span>
                              {issue.idg_reasons.map((reason, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* All patients (shown when census is toggled) */}
              {showCensus && (
                <>
                  {isLoadingPatients ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Loading patients...</p>
                    </div>
                  ) : (
                    allPatients.map((patient) => {
                      const daysRemaining = calculateDaysRemaining(patient);
                      const patientIssues = groupedByPatient[patient.id];
                      const hasIssues = !!patientIssues;
                      const issueCount = hasIssues ? patientIssues.issues.length : 0;

                      return (
                        <div key={patient.id} className="border rounded-lg overflow-hidden">
                          {/* Patient Header */}
                          <div
                            className={`bg-[#FAFAF8] px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              selectedPatientIds.has(patient.id) ? 'bg-[#2D7A7A]/10 ring-1 ring-[#2D7A7A] ring-inset' : ''
                            }`}
                            onClick={() => handlePatientToggle(patient.id)}
                          >
                            <Checkbox
                              checked={selectedPatientIds.has(patient.id)}
                              onCheckedChange={() => handlePatientToggle(patient.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Users className="w-4 h-4 text-[#2D7A7A]" />
                            <span className="font-medium">{patient.first_name} {patient.last_name}</span>
                            <span className="text-xs text-muted-foreground">MRN: {patient.mrn}</span>

                            {/* Benefit Period Badge */}
                            {patient.benefit_period && (
                              <Badge
                                variant="outline"
                                className={`ml-2 ${
                                  daysRemaining !== null && daysRemaining <= 14
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                BP{patient.benefit_period}
                                {daysRemaining !== null && ` · ${daysRemaining}d left`}
                              </Badge>
                            )}

                            <Badge variant="outline" className={`ml-auto ${hasIssues ? 'text-[#2D7A7A]' : 'text-muted-foreground'}`}>
                              {hasIssues ? `${issueCount} issue${issueCount !== 1 ? 's' : ''}` : 'No issues'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => setShowCensus(!showCensus)}
            className="mr-auto"
          >
            {showCensus ? 'Hide Complete Census' : 'Show Complete Census'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={totalSelectedCount === 0}
            className="bg-[#2D7A7A] hover:bg-[#236060]"
          >
            Start IDG Meeting ({totalSelectedCount} item{totalSelectedCount !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
