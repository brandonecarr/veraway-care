'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Download, Users, FileText, CheckCircle2, CalendarClock, AlertTriangle, Calendar as CalendarIcon, ClipboardList, ChevronDown, ChevronRight, Archive, Trash2, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { format, subDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { IDGSummaryStats } from '@/components/care/idg-summary-stats';
import { IDGIssueList } from '@/components/care/idg-issue-list';
import { IssueDetailPanel } from '@/components/care/issue-detail-panel';
import { IDGCompletionModal } from '@/components/care/idg-completion-modal';
import { IDGIssueSelectionModal } from '@/components/care/idg-issue-selection-modal';
import { generateIDGPDF } from '@/components/care/idg-pdf-export';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface IDGReviewClientProps {
  slug: string;
}

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
  assignee_name: string;
  assignee_job_role: string | null;
  hours_open: number;
  is_overdue: boolean;
  idg_reasons: string[];
  actions_taken?: any[];
  outstanding_next_steps?: any[];
  flagged_for_md_review?: boolean;
  idg_disposition?: string | null;
  reviewed_in_idg?: boolean;
}

interface IDGSummary {
  // New stats format
  totalActivePatients: number;
  admissionsThisWeek: number;
  dischargesThisWeek: number;
  deathsThisWeek: number;
  totalIssuesIncluded: number;
  highPriorityOverdueCount: number;
  // Legacy fields for backwards compatibility
  totalIssues: number;
  byPriority: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  byStatus: {
    open: number;
    in_progress: number;
  };
  overdue: number;
  expiringBenefitPeriods?: number;
  byIssueType: Record<string, number>;
  dateRange: { start: string; end: string };
  thresholdHours: number;
}

interface ExpiringBenefitPeriod {
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  benefit_period: number;
  days_remaining: number;
  end_date: string;
}

interface PreviousReview {
  completed_at: string;
  disciplines_present: string[];
  total_issues_reviewed: number;
}

interface CensusPatient {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  benefit_period: number | null;
  admission_date: string | null;
}

interface ArchivedOutline {
  id: string;
  archivedAt: string;
  meetingStartedAt: string;
  fromDate: string;
  toDate: string;
  selectedIssueIds: string[];
  selectedPatientIds: string[];
  censusPatients: CensusPatient[];
  issues: IDGIssue[];
  issueCount: number;
  patientCount: number;
}

export default function IDGReviewClient({ slug }: IDGReviewClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [issues, setIssues] = useState<IDGIssue[]>([]);
  const [grouped, setGrouped] = useState<Record<string, any>>({});
  const [summary, setSummary] = useState<IDGSummary | null>(null);
  const [expiringBenefitPeriods, setExpiringBenefitPeriods] = useState<ExpiringBenefitPeriod[]>([]);

  // PDF export data
  const [hospiceName, setHospiceName] = useState<string>('');
  const [admissionsPatients, setAdmissionsPatients] = useState<any[]>([]);
  const [dischargesPatients, setDischargesPatients] = useState<any[]>([]);
  const [fullCensusPatients, setFullCensusPatients] = useState<any[]>([]);
  const [totalCensusCount, setTotalCensusCount] = useState<number>(0);

  // Date range controls (replacing week navigation)
  const [fromDate, setFromDate] = useState<Date>(() => subDays(new Date(), 7));
  const [toDate, setToDate] = useState<Date>(() => new Date());
  const [threshold, setThreshold] = useState('24');
  const [groupBy, setGroupBy] = useState<'patient' | 'issue_type'>('patient');

  // Meeting workflow state - initialized from localStorage if available
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [meetingStartedAt, setMeetingStartedAt] = useState<string | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set()); // Census patients without issues
  const [censusPatients, setCensusPatients] = useState<CensusPatient[]>([]);
  const [isIssueSelectionModalOpen, setIsIssueSelectionModalOpen] = useState(false);
  const [outlineLoaded, setOutlineLoaded] = useState(false);

  // Collapsible state for current outline
  const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);

  // Archived outlines
  const [archivedOutlines, setArchivedOutlines] = useState<ArchivedOutline[]>([]);
  const [expandedArchives, setExpandedArchives] = useState<Set<string>>(new Set());
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveSearchDate, setArchiveSearchDate] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'current' | 'archived'>('current');

  // LocalStorage keys for persisting IDG outline and archives
  const OUTLINE_STORAGE_KEY = `idg-outline-${slug}`;
  const ARCHIVES_STORAGE_KEY = `idg-archives-${slug}`;

  // Issue detail panel
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // IDG completion state
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [dispositions, setDispositions] = useState<{ value: string; label: string }[]>([]);
  const [previousReview, setPreviousReview] = useState<PreviousReview | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Format dates for API calls
  const fromDateStr = format(fromDate, 'yyyy-MM-dd');
  const toDateStr = format(toDate, 'yyyy-MM-dd');

  useEffect(() => {
    const initUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(userProfile);

      const { data: users } = await supabase.from('users').select('*');
      setAvailableUsers(users || []);
    };
    initUser();
  }, []);

  // Load IDG outline and archives from localStorage on mount
  useEffect(() => {
    try {
      // Load current outline
      const saved = localStorage.getItem(OUTLINE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasIssues = parsed.selectedIssueIds?.length > 0;
        const hasPatients = parsed.selectedPatientIds?.length > 0;
        if (parsed.meetingStarted && (hasIssues || hasPatients)) {
          setMeetingStarted(true);
          setMeetingStartedAt(parsed.meetingStartedAt);
          setSelectedIssueIds(new Set(parsed.selectedIssueIds || []));
          setSelectedPatientIds(new Set(parsed.selectedPatientIds || []));
          if (parsed.censusPatients) {
            setCensusPatients(parsed.censusPatients);
          }
          console.log('IDG Outline restored from localStorage:', parsed.selectedIssueIds?.length || 0, 'issues,', parsed.selectedPatientIds?.length || 0, 'census patients');
        }
      }

      // Load archived outlines
      const savedArchives = localStorage.getItem(ARCHIVES_STORAGE_KEY);
      if (savedArchives) {
        const parsedArchives = JSON.parse(savedArchives);
        if (Array.isArray(parsedArchives)) {
          setArchivedOutlines(parsedArchives);
          console.log('IDG Archives restored from localStorage:', parsedArchives.length, 'archived outlines');
        }
      }
    } catch (e) {
      console.error('Error loading IDG data from localStorage:', e);
    }
    setOutlineLoaded(true);
  }, [OUTLINE_STORAGE_KEY, ARCHIVES_STORAGE_KEY]);

  // Save IDG outline to localStorage when it changes
  useEffect(() => {
    if (!outlineLoaded) return; // Don't save until we've loaded

    if (meetingStarted && (selectedIssueIds.size > 0 || selectedPatientIds.size > 0)) {
      const toSave = {
        meetingStarted,
        meetingStartedAt,
        selectedIssueIds: Array.from(selectedIssueIds),
        selectedPatientIds: Array.from(selectedPatientIds),
        censusPatients,
      };
      localStorage.setItem(OUTLINE_STORAGE_KEY, JSON.stringify(toSave));
    } else if (!meetingStarted) {
      localStorage.removeItem(OUTLINE_STORAGE_KEY);
    }
  }, [meetingStarted, meetingStartedAt, selectedIssueIds, selectedPatientIds, censusPatients, outlineLoaded, OUTLINE_STORAGE_KEY]);

  useEffect(() => {
    fetchIDGData();
  }, [fromDateStr, toDateStr, threshold, groupBy]);

  const fetchIDGData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate: fromDateStr,
        toDate: toDateStr,
        threshold,
        groupBy
      });

      const response = await fetch(`/api/idg-review?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch IDG data');
      }

      const data = await response.json();
      setIssues(data.issues || []);
      setGrouped(data.grouped || {});
      setSummary(data.summary || null);
      setExpiringBenefitPeriods(data.expiringBenefitPeriods || []);
      setDisciplines(data.disciplines || []);
      setDispositions(data.dispositions || []);
      setPreviousReview(data.previousReview || null);
      // PDF export data
      setHospiceName(data.hospiceName || '');
      setAdmissionsPatients(data.admissionsPatients || []);
      setDischargesPatients(data.dischargesPatients || []);
      setFullCensusPatients(data.censusPatients || []);
      setTotalCensusCount(data.totalCensusCount || 0);
    } catch (error) {
      console.error('Error fetching IDG data:', error);
      setIssues([]);
      setGrouped({});
      setSummary(null);
      setExpiringBenefitPeriods([]);
      setHospiceName('');
      setAdmissionsPatients([]);
      setDischargesPatients([]);
      setFullCensusPatients([]);
      setTotalCensusCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle starting the IDG meeting
  const handleStartMeeting = async (issueIds: string[], patientIds: string[]) => {
    setSelectedIssueIds(new Set(issueIds));
    setSelectedPatientIds(new Set(patientIds));
    setMeetingStartedAt(new Date().toISOString());
    setMeetingStarted(true);

    // Fetch census patient data if any patients were selected
    if (patientIds.length > 0) {
      try {
        const response = await fetch(`/api/patients?status=active`);
        if (response.ok) {
          const result = await response.json();
          const patients = result.data || [];
          // Filter to only selected patients
          const selectedCensusPatients = patients.filter((p: any) => patientIds.includes(p.id));
          setCensusPatients(selectedCensusPatients);
        }
      } catch (error) {
        console.error('Failed to fetch census patients:', error);
      }
    }

    const totalItems = issueIds.length + patientIds.length;
    toast.success('IDG Outline Created', {
      description: `${totalItems} item${totalItems !== 1 ? 's' : ''} selected for review.`,
    });
  };

  // Reset meeting state and clear localStorage
  const resetMeeting = () => {
    setMeetingStarted(false);
    setMeetingStartedAt(null);
    setSelectedIssueIds(new Set());
    setSelectedPatientIds(new Set());
    setCensusPatients([]);
    localStorage.removeItem(OUTLINE_STORAGE_KEY);
  };

  // Archive the current outline
  const archiveOutline = () => {
    if (!meetingStarted || (selectedIssueIds.size === 0 && selectedPatientIds.size === 0)) {
      return;
    }

    const archivedOutline: ArchivedOutline = {
      id: crypto.randomUUID(),
      archivedAt: new Date().toISOString(),
      meetingStartedAt: meetingStartedAt || new Date().toISOString(),
      fromDate: fromDateStr,
      toDate: toDateStr,
      selectedIssueIds: Array.from(selectedIssueIds),
      selectedPatientIds: Array.from(selectedPatientIds),
      censusPatients,
      issues: displayedIssues,
      issueCount: selectedIssueIds.size,
      patientCount: selectedPatientIds.size,
    };

    const newArchives = [archivedOutline, ...archivedOutlines];
    setArchivedOutlines(newArchives);
    localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(newArchives));

    // Reset the current outline
    resetMeeting();

    toast.success('IDG Outline Archived', {
      description: `Outline from ${format(new Date(archivedOutline.meetingStartedAt), 'MMM d, yyyy')} has been archived.`,
    });
  };

  // Delete an archived outline
  const deleteArchivedOutline = (archiveId: string) => {
    const newArchives = archivedOutlines.filter(a => a.id !== archiveId);
    setArchivedOutlines(newArchives);
    localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(newArchives));

    // Remove from expanded set if it was expanded
    setExpandedArchives(prev => {
      const next = new Set(prev);
      next.delete(archiveId);
      return next;
    });

    toast.success('Archive Deleted', {
      description: 'The archived outline has been removed.',
    });
  };

  // Toggle archive expansion
  const toggleArchiveExpansion = (archiveId: string) => {
    setExpandedArchives(prev => {
      const next = new Set(prev);
      if (next.has(archiveId)) {
        next.delete(archiveId);
      } else {
        next.add(archiveId);
      }
      return next;
    });
  };

  // Filter archived outlines by search query and date
  const filteredArchivedOutlines = archivedOutlines.filter(archive => {
    // Filter by date if set
    if (archiveSearchDate) {
      const archiveDate = new Date(archive.meetingStartedAt);
      const searchDateOnly = format(archiveSearchDate, 'yyyy-MM-dd');
      const archiveDateOnly = format(archiveDate, 'yyyy-MM-dd');
      if (searchDateOnly !== archiveDateOnly) return false;
    }

    // Filter by search query (patient names, issue types)
    if (archiveSearchQuery.trim()) {
      const query = archiveSearchQuery.toLowerCase();
      const matchesIssue = archive.issues.some(issue =>
        issue.patient_name.toLowerCase().includes(query) ||
        issue.issue_type.toLowerCase().includes(query) ||
        issue.patient_mrn.toLowerCase().includes(query)
      );
      const matchesPatient = archive.censusPatients.some(patient =>
        `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(query) ||
        patient.mrn.toLowerCase().includes(query)
      );
      const matchesDate = format(new Date(archive.meetingStartedAt), 'MMMM d, yyyy').toLowerCase().includes(query);
      if (!matchesIssue && !matchesPatient && !matchesDate) return false;
    }

    return true;
  });

  // Calculate days remaining in benefit period
  const calculateDaysRemaining = (patient: CensusPatient): number | null => {
    if (!patient.benefit_period || !patient.admission_date) return null;

    const admissionDate = new Date(patient.admission_date);
    const today = new Date();
    const daysSinceAdmission = differenceInDays(today, admissionDate);

    // BP1-2: 90 days, BP3+: 60 days
    const periodLength = patient.benefit_period <= 2 ? 90 : 60;
    const daysRemaining = periodLength - daysSinceAdmission;

    return Math.max(0, daysRemaining);
  };

  // Get issues to display based on meeting state
  const displayedIssues = meetingStarted
    ? issues.filter(i => selectedIssueIds.has(i.id))
    : [];

  // Get grouped data for displayed issues
  const displayedGrouped = meetingStarted
    ? Object.entries(grouped).reduce((acc, [key, value]) => {
        if (groupBy === 'patient' && value?.issues) {
          const filteredIssues = value.issues.filter((i: IDGIssue) => selectedIssueIds.has(i.id));
          if (filteredIssues.length > 0) {
            acc[key] = { ...value, issues: filteredIssues };
          }
        } else if (Array.isArray(value)) {
          const filteredIssues = value.filter((i: IDGIssue) => selectedIssueIds.has(i.id));
          if (filteredIssues.length > 0) {
            acc[key] = filteredIssues;
          }
        }
        return acc;
      }, {} as Record<string, any>)
    : {};

  // Helper to update an issue in both issues and grouped state
  const updateIssueInState = (issueId: string, updates: Partial<IDGIssue>) => {
    // Update issues array
    setIssues(prev => prev.map(issue =>
      issue.id === issueId ? { ...issue, ...updates } : issue
    ));

    // Update grouped state based on current groupBy mode
    setGrouped(prev => {
      const newGrouped = { ...prev };
      if (groupBy === 'patient') {
        // Grouped by patient: { patientId: { patient_id, patient_name, patient_mrn, issues: [...] } }
        for (const key in newGrouped) {
          if (newGrouped[key]?.issues) {
            newGrouped[key] = {
              ...newGrouped[key],
              issues: newGrouped[key].issues.map((issue: IDGIssue) =>
                issue.id === issueId ? { ...issue, ...updates } : issue
              )
            };
          }
        }
      } else {
        // Grouped by issue_type: { issueType: [...issues] }
        for (const key in newGrouped) {
          if (Array.isArray(newGrouped[key])) {
            newGrouped[key] = newGrouped[key].map((issue: IDGIssue) =>
              issue.id === issueId ? { ...issue, ...updates } : issue
            );
          }
        }
      }
      return newGrouped;
    });
  };

  const handleIssueClick = (issue: IDGIssue) => {
    // Transform to match Issue type for detail panel
    const fullIssue = {
      id: issue.id,
      issue_number: issue.issue_number,
      patient_id: issue.patient_id,
      issue_type: issue.issue_type,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      created_at: issue.created_at,
      patient: {
        first_name: issue.patient_name.split(' ')[0] || '',
        last_name: issue.patient_name.split(' ').slice(1).join(' ') || '',
        mrn: issue.patient_mrn
      }
    };
    setSelectedIssue(fullIssue);
    setIsDetailPanelOpen(true);
  };

  const handleFlagForMD = async (issueId: string, flagged: boolean) => {
    try {
      const response = await fetch('/api/idg-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, flaggedForMD: flagged })
      });

      if (!response.ok) {
        throw new Error('Failed to update MD review flag');
      }

      // Update local state
      updateIssueInState(issueId, { flagged_for_md_review: flagged });

      toast.success(flagged ? 'Flagged for MD Review' : 'MD Review flag removed', {
        description: `Issue has been ${flagged ? 'flagged for' : 'removed from'} MD review.`,
      });
    } catch (error) {
      console.error('Error updating MD review flag:', error);
      toast.error('Failed to update MD review flag. Please try again.');
    }
  };

  const handleDispositionChange = async (issueId: string, disposition: string) => {
    try {
      const response = await fetch('/api/idg-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, disposition })
      });

      if (!response.ok) {
        throw new Error('Failed to update disposition');
      }

      // Update local state
      updateIssueInState(issueId, { idg_disposition: disposition });

      const dispositionLabel = dispositions.find(d => d.value === disposition)?.label || disposition;
      toast.success('Disposition updated', {
        description: `Issue disposition set to "${dispositionLabel}".`,
      });
    } catch (error) {
      console.error('Error updating disposition:', error);
      toast.error('Failed to update disposition. Please try again.');
    }
  };

  const handleCompleteIDGReview = async (disciplinesPresent: string[]) => {
    try {
      const response = await fetch('/api/idg-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: fromDateStr,
          toDate: toDateStr,
          disciplinesPresent,
          selectedIssueIds: Array.from(selectedIssueIds),
          meetingStartedAt,
          admissionsCount: summary?.admissionsThisWeek || 0,
          deathsCount: summary?.deathsThisWeek || 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to complete IDG review');
      }

      // Auto-archive the completed outline before resetting
      if (meetingStarted && (selectedIssueIds.size > 0 || selectedPatientIds.size > 0)) {
        const archivedOutline: ArchivedOutline = {
          id: crypto.randomUUID(),
          archivedAt: new Date().toISOString(),
          meetingStartedAt: meetingStartedAt || new Date().toISOString(),
          fromDate: fromDateStr,
          toDate: toDateStr,
          selectedIssueIds: Array.from(selectedIssueIds),
          selectedPatientIds: Array.from(selectedPatientIds),
          censusPatients,
          issues: displayedIssues,
          issueCount: selectedIssueIds.size,
          patientCount: selectedPatientIds.size,
        };

        const newArchives = [archivedOutline, ...archivedOutlines];
        setArchivedOutlines(newArchives);
        localStorage.setItem(ARCHIVES_STORAGE_KEY, JSON.stringify(newArchives));
      }

      toast.success('IDG Review Completed', {
        description: `Review recorded with ${disciplinesPresent.length} disciplines present and ${selectedIssueIds.size} issues reviewed. Outline has been archived.`,
      });

      // Reset meeting state and refresh data
      resetMeeting();
      fetchIDGData();
    } catch (error) {
      console.error('Error completing IDG review:', error);
      toast.error('Failed to complete IDG review. Please try again.');
      throw error; // Re-throw so modal knows it failed
    }
  };

  // Build summary for stats display (with overrides for selected issues)
  const displaySummary = summary ? {
    ...summary,
    totalIssuesIncluded: meetingStarted ? selectedIssueIds.size : 0
  } : null;

  return (
    <main className="min-h-screen bg-[#FAFAF8] pb-24 md:pb-6">
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-12 space-y-6 md:space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold text-[#1A1A1A]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              IDG Issue Review
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Weekly review of issues requiring IDG discussion
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2 w-fit"
              disabled={isExporting || isLoading || !meetingStarted}
              title={!meetingStarted ? 'Create an IDG outline first to export PDF' : undefined}
              onClick={async () => {
                if (!summary) return;
                setIsExporting(true);
                try {
                  await generateIDGPDF({
                    issues: displayedIssues,
                    summary,
                    weekStart: fromDateStr,
                    weekEnd: toDateStr,
                    groupBy,
                    // New PDF export data
                    hospiceName,
                    meetingDateTime: meetingStartedAt || undefined,
                    censusPatients: fullCensusPatients,
                    admissions: admissionsPatients,
                    discharges: dischargesPatients,
                    expiringBenefitPeriods,
                    totalCensusCount
                  });
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </Button>

            {!meetingStarted ? (
              <Button
                className="flex items-center gap-2 bg-[#2D7A7A] hover:bg-[#236060]"
                disabled={isLoading}
                onClick={() => setIsIssueSelectionModalOpen(true)}
              >
                <ClipboardList className="w-4 h-4" />
                Create IDG Meeting Outline
              </Button>
            ) : (
              <Button
                className="flex items-center gap-2 bg-[#2D7A7A] hover:bg-[#236060]"
                disabled={isLoading || (selectedIssueIds.size === 0 && selectedPatientIds.size === 0)}
                onClick={() => setIsCompletionModalOpen(true)}
              >
                <CheckCircle2 className="w-4 h-4" />
                IDG Review Completed
              </Button>
            )}
          </div>
        </div>

        {/* Controls */}
        <Card className="p-4 bg-white border-[#D4D4D4]">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Date Range Pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground whitespace-nowrap">From:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                    disabled={meetingStarted}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-sm text-muted-foreground whitespace-nowrap">To:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                    disabled={meetingStarted}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {meetingStarted && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 ml-2">
                  Meeting in progress
                </Badge>
              )}
            </div>

            <div className="flex-1" />

            {/* Threshold Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Unresolved threshold:
              </span>
              <Select value={threshold} onValueChange={setThreshold} disabled={meetingStarted}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                  <SelectItem value="72">72 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Group By Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Group by:
              </span>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'patient' | 'issue_type')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Patient
                    </div>
                  </SelectItem>
                  <SelectItem value="issue_type">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Issue Type
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Summary Stats */}
        <IDGSummaryStats data={displaySummary || undefined} isLoading={isLoading} />

        {/* Tabbed Interface for Current Outline and Archives */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'current' | 'archived')} className="space-y-4">
          <TabsList className="bg-white border border-[#D4D4D4]">
            <TabsTrigger value="current" className="data-[state=active]:bg-[#2D7A7A] data-[state=active]:text-white">
              <ClipboardList className="w-4 h-4 mr-2" />
              Current Outline
              {meetingStarted && (
                <Badge variant="secondary" className="ml-2 bg-[#2D7A7A]/20">
                  {selectedIssueIds.size + selectedPatientIds.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="data-[state=active]:bg-[#2D7A7A] data-[state=active]:text-white">
              <Archive className="w-4 h-4 mr-2" />
              Archived Outlines
              {archivedOutlines.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {archivedOutlines.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Current Outline Tab */}
          <TabsContent value="current" className="space-y-6">
            {!meetingStarted ? (
              <Card className="p-8 md:p-12 bg-white border-[#D4D4D4] text-center">
                <div className="max-w-md mx-auto">
                  <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    No Meeting in Progress
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Click &quot;Create IDG Meeting Outline&quot; to select issues and start your IDG review meeting.
                  </p>
                  {issues.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {issues.length} issue{issues.length !== 1 ? 's' : ''} available for review in this date range.
                    </p>
                  )}
                </div>
              </Card>
            ) : (
              /* Current IDG Outline - Collapsible Card */
              <Card className="bg-white border-[#D4D4D4] overflow-hidden">
                {/* Collapsible Header */}
                <div
                  className="flex items-center justify-between p-4 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setIsOutlineExpanded(!isOutlineExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOutlineExpanded(!isOutlineExpanded);
                      }}
                    >
                      {isOutlineExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#666]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#666]" />
                      )}
                    </button>
                    <div className="p-2 rounded-lg bg-[#2D7A7A]/10">
                      <ClipboardList className="w-5 h-5 text-[#2D7A7A]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        IDG Outline — {meetingStartedAt ? format(new Date(meetingStartedAt), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy')}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {displayedIssues.length} issue{displayedIssues.length !== 1 ? 's' : ''}
                        {censusPatients.length > 0 && ` • ${censusPatients.length} census patient${censusPatients.length !== 1 ? 's' : ''}`}
                        {' '}• Created {meetingStartedAt ? format(new Date(meetingStartedAt), 'h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveOutline();
                    }}
                  >
                    <Archive className="w-4 h-4" />
                    Archive Outline
                  </Button>
                </div>

                {/* Collapsible Content */}
                {isOutlineExpanded && (
                  <div className="border-t border-[#D4D4D4] p-4 md:p-6 space-y-6">
                    {/* Issue List */}
                    {displayedIssues.length > 0 && (
                      <IDGIssueList
                        issues={displayedIssues}
                        grouped={displayedGrouped}
                        groupBy={groupBy}
                        onIssueClick={handleIssueClick}
                        onFlagForMD={handleFlagForMD}
                        onDispositionChange={handleDispositionChange}
                        dispositions={dispositions}
                      />
                    )}

                    {/* Census Patients */}
                    {censusPatients.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 rounded-lg bg-teal-100">
                            <Users className="w-5 h-5 text-teal-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                              Census Patients
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {censusPatients.length} patient{censusPatients.length !== 1 ? 's' : ''} selected from census (no active issues)
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {censusPatients.map((patient) => {
                            const daysRemaining = calculateDaysRemaining(patient);
                            return (
                              <div
                                key={patient.id}
                                className="flex items-center justify-between p-3 bg-[#FAFAF8] border border-[#D4D4D4] rounded-lg hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="font-medium text-[#1A1A1A]">
                                      {patient.first_name} {patient.last_name}
                                    </p>
                                    <p className="text-sm text-[#666]">MRN: {patient.mrn}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {patient.benefit_period && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        daysRemaining !== null && daysRemaining <= 14
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-teal-50 text-teal-700 border-teal-200'
                                      )}
                                    >
                                      <CalendarClock className="w-3 h-3 mr-1" />
                                      BP{patient.benefit_period}
                                      {daysRemaining !== null && ` · ${daysRemaining}d left`}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                    No active issues
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state if no issues or patients */}
                    {displayedIssues.length === 0 && censusPatients.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No items in this outline.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Expiring Benefit Periods */}
            {expiringBenefitPeriods.length > 0 && (
              <Card className="p-4 md:p-6 bg-white border-[#D4D4D4]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <CalendarClock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A1A1A]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      Benefit Period Expiring
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Patients with ≤14 days remaining - Face-to-Face visit required
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {expiringBenefitPeriods.map((patient) => (
                    <div
                      key={patient.patient_id}
                      className="flex items-center justify-between p-3 bg-[#FAFAF8] border border-[#D4D4D4] rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-[#1A1A1A]">{patient.patient_name}</p>
                          <p className="text-sm text-[#666]">MRN: {patient.patient_mrn}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          BP{patient.benefit_period}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={patient.days_remaining <= 7
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {patient.days_remaining === 0 ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Expired
                            </span>
                          ) : (
                            `${patient.days_remaining} days remaining`
                          )}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Archived Outlines Tab */}
          <TabsContent value="archived" className="space-y-4">
            {/* Search and Filter Controls */}
            <Card className="p-4 bg-white border-[#D4D4D4]">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name, MRN, or issue type..."
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by date:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[160px] justify-start text-left font-normal",
                          !archiveSearchDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {archiveSearchDate ? format(archiveSearchDate, "MMM d, yyyy") : "Any date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={archiveSearchDate}
                        onSelect={setArchiveSearchDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {archiveSearchDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchiveSearchDate(undefined)}
                      className="px-2"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Active filters display */}
              {(archiveSearchQuery || archiveSearchDate) && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#D4D4D4]">
                  <span className="text-sm text-muted-foreground">Showing:</span>
                  <span className="text-sm font-medium">
                    {filteredArchivedOutlines.length} of {archivedOutlines.length} archived outline{archivedOutlines.length !== 1 ? 's' : ''}
                  </span>
                  {(archiveSearchQuery || archiveSearchDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setArchiveSearchQuery('');
                        setArchiveSearchDate(undefined);
                      }}
                      className="ml-auto text-xs"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Archived Outlines List */}
            {filteredArchivedOutlines.length === 0 ? (
              <Card className="p-8 md:p-12 bg-white border-[#D4D4D4] text-center">
                <div className="max-w-md mx-auto">
                  <Archive className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {archivedOutlines.length === 0 ? 'No Archived Outlines' : 'No Matching Archives'}
                  </h3>
                  <p className="text-muted-foreground">
                    {archivedOutlines.length === 0
                      ? 'Archived outlines will appear here after you complete or archive an IDG meeting.'
                      : 'No archived outlines match your search criteria. Try adjusting your filters.'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredArchivedOutlines.map((archive) => (
                  <Card key={archive.id} className="bg-white border-[#D4D4D4] overflow-hidden">
                    {/* Archive Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleArchiveExpansion(archive.id)}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleArchiveExpansion(archive.id);
                          }}
                        >
                          {expandedArchives.has(archive.id) ? (
                            <ChevronDown className="w-5 h-5 text-[#666]" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-[#666]" />
                          )}
                        </button>
                        <div className="p-2 rounded-lg bg-gray-100">
                          <ClipboardList className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium text-[#1A1A1A]">
                            IDG Outline — {format(new Date(archive.meetingStartedAt), 'MMMM d, yyyy')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {archive.issueCount} issue{archive.issueCount !== 1 ? 's' : ''}
                            {archive.patientCount > 0 && ` • ${archive.patientCount} census patient${archive.patientCount !== 1 ? 's' : ''}`}
                            {' '}• Archived {format(new Date(archive.archivedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteArchivedOutline(archive.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Archive Content */}
                    {expandedArchives.has(archive.id) && (
                      <div className="border-t border-[#D4D4D4] p-4 space-y-4 bg-gray-50/50">
                        {/* Archived Issues */}
                        {archive.issues.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-[#666]">Issues ({archive.issues.length})</h4>
                            <div className="space-y-2">
                              {archive.issues.map((issue) => (
                                <div
                                  key={issue.id}
                                  className="flex items-center justify-between p-3 bg-white border border-[#D4D4D4] rounded-lg"
                                >
                                  <div>
                                    <p className="font-medium text-[#1A1A1A]">{issue.patient_name}</p>
                                    <p className="text-sm text-[#666]">
                                      {issue.issue_type} • MRN: {issue.patient_mrn}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      issue.priority === 'urgent' && 'bg-red-50 text-red-700 border-red-200',
                                      issue.priority === 'high' && 'bg-orange-50 text-orange-700 border-orange-200',
                                      issue.priority === 'normal' && 'bg-blue-50 text-blue-700 border-blue-200',
                                      issue.priority === 'low' && 'bg-gray-50 text-gray-600 border-gray-200'
                                    )}
                                  >
                                    {issue.priority}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Archived Census Patients */}
                        {archive.censusPatients.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-[#666]">Census Patients ({archive.censusPatients.length})</h4>
                            <div className="space-y-2">
                              {archive.censusPatients.map((patient) => {
                                const daysRemaining = calculateDaysRemaining(patient);
                                return (
                                  <div
                                    key={patient.id}
                                    className="flex items-center justify-between p-3 bg-white border border-[#D4D4D4] rounded-lg"
                                  >
                                    <div>
                                      <p className="font-medium text-[#1A1A1A]">{patient.first_name} {patient.last_name}</p>
                                      <p className="text-sm text-[#666]">MRN: {patient.mrn}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {patient.benefit_period && (
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            daysRemaining !== null && daysRemaining <= 14
                                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                                              : 'bg-teal-50 text-teal-700 border-teal-200'
                                          )}
                                        >
                                          <CalendarClock className="w-3 h-3 mr-1" />
                                          BP{patient.benefit_period}
                                          {daysRemaining !== null && ` · ${daysRemaining}d left`}
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                        No active issues
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selectedIssue}
        open={isDetailPanelOpen}
        onOpenChange={(open) => {
          setIsDetailPanelOpen(open);
          if (!open) setSelectedIssue(null);
        }}
        onResolve={(issueId) => {
          // Update local state
          setIssues(prev => prev.filter(i => i.id !== issueId));
          // Refresh data
          fetchIDGData();
        }}
        onAssign={() => {
          // Refresh data on assignment
          fetchIDGData();
        }}
        currentUserId={currentUser?.id || ''}
        userRole="coordinator"
        availableUsers={availableUsers}
      />

      {/* IDG Issue Selection Modal */}
      <IDGIssueSelectionModal
        open={isIssueSelectionModalOpen}
        onOpenChange={setIsIssueSelectionModalOpen}
        onConfirm={handleStartMeeting}
        issues={issues}
        fromDate={fromDateStr}
        toDate={toDateStr}
        hospiceSlug={slug}
      />

      {/* IDG Completion Modal */}
      <IDGCompletionModal
        open={isCompletionModalOpen}
        onOpenChange={setIsCompletionModalOpen}
        onComplete={handleCompleteIDGReview}
        weekStart={fromDateStr}
        weekEnd={toDateStr}
        disciplines={disciplines}
        issueCount={selectedIssueIds.size}
        admissionsCount={summary?.admissionsThisWeek || 0}
        deathsCount={summary?.deathsThisWeek || 0}
        previousReview={previousReview}
      />
    </main>
  );
}
