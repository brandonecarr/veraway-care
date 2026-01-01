'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Download, Users, FileText } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { IDGSummaryStats } from '@/components/care/idg-summary-stats';
import { IDGIssueList } from '@/components/care/idg-issue-list';
import { IssueDetailPanel } from '@/components/care/issue-detail-panel';
import { generateIDGPDF } from '@/components/care/idg-pdf-export';
import { createClient } from '@/lib/supabase/client';

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
  idg_reason: string;
  actions_taken?: any[];
  outstanding_next_steps?: any[];
}

interface IDGSummary {
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
  byIssueType: Record<string, number>;
  weekRange: { start: string; end: string };
  thresholdHours: number;
}

export default function IDGReviewClient({ slug }: IDGReviewClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [issues, setIssues] = useState<IDGIssue[]>([]);
  const [grouped, setGrouped] = useState<Record<string, any>>({});
  const [summary, setSummary] = useState<IDGSummary | null>(null);

  // State for controls
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [threshold, setThreshold] = useState('24');
  const [groupBy, setGroupBy] = useState<'patient' | 'issue_type'>('patient');

  // Issue detail panel
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');

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

  useEffect(() => {
    fetchIDGData();
  }, [weekStart, weekEnd, threshold, groupBy]);

  const fetchIDGData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        weekStart,
        weekEnd,
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
    } catch (error) {
      console.error('Error fetching IDG data:', error);
      setIssues([]);
      setGrouped({});
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
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

  const isCurrentWeek = format(currentWeekStart, 'yyyy-MM-dd') ===
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  return (
    <main className="min-h-screen bg-[#FAFAF8] p-4 md:p-6 pb-24 md:pb-6">
      <div className="container mx-auto space-y-6">
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

          <Button
            variant="outline"
            className="flex items-center gap-2 w-fit"
            disabled={isExporting || isLoading || issues.length === 0}
            onClick={async () => {
              if (!summary) return;
              setIsExporting(true);
              try {
                await generateIDGPDF({
                  issues,
                  summary,
                  weekStart,
                  weekEnd,
                  groupBy
                });
              } finally {
                setIsExporting(false);
              }
            }}
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>

        {/* Controls */}
        <Card className="p-4 bg-white border-[#D4D4D4]">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="font-medium">
                  {format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                </p>
                {!isCurrentWeek && (
                  <button
                    onClick={goToCurrentWeek}
                    className="text-xs text-[#2D7A7A] hover:underline"
                  >
                    Go to current week
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                disabled={isCurrentWeek}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1" />

            {/* Threshold Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Unresolved threshold:
              </span>
              <Select value={threshold} onValueChange={setThreshold}>
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
        <IDGSummaryStats data={summary || undefined} isLoading={isLoading} />

        {/* Issue List */}
        <IDGIssueList
          issues={issues}
          grouped={grouped}
          groupBy={groupBy}
          onIssueClick={handleIssueClick}
        />
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
    </main>
  );
}
