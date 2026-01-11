'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { IssueStatus } from '@/types/care-coordination';
import { Clock, AlertCircle, CheckCircle2, TrendingUp, X, ChevronLeft, ChevronRight, Archive, MessageSquare, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { MetricCard } from './metric-card';
import { QuickReportModal } from './quick-report-modal';
import { IssueDetailPanel } from './issue-detail-panel';
import { AfterShiftReportModal } from './after-shift-report-modal';
import { AfterShiftReportBanner } from './after-shift-report-banner';
import { IssueCard } from './issue-card';
import { ConnectionStatus } from './connection-status';
import { IssueCardSkeleton, MetricCardSkeleton, ChartSkeleton } from './loading-skeletons';
import { IssueAcknowledgeModal } from './issue-acknowledge-modal';

// Dynamic imports for chart components to reduce initial bundle size
const IssuesByTypeChart = dynamic(
  () => import('./issues-by-type-chart').then((mod) => mod.IssuesByTypeChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

const ClinicianResponsiveness = dynamic(
  () => import('./clinician-responsiveness').then((mod) => mod.ClinicianResponsiveness),
  { loading: () => <ChartSkeleton />, ssr: false }
);
import { ErrorBoundary } from '@/components/error-boundary';
import type { Issue, DashboardMetrics } from '@/types/care-coordination';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ISSUE_TYPE_COLORS } from '@/types/care-coordination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeIssues } from '@/hooks/use-realtime-issues';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

const ITEMS_PER_PAGE_DESKTOP = 6; // 3 columns x 2 rows
const ITEMS_PER_PAGE_MOBILE = 5;

interface CareCoordinationDashboardProps {
  userId: string;
  userRole: string;
}

export function CareCoordinationDashboard({ userId, userRole }: CareCoordinationDashboardProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const { issues: realtimeIssues, isConnected, isLoading, refreshIssues } = useRealtimeIssues();
  const { totalUnread, latestConversation } = useUnreadMessages();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'my' | 'overdue'>('my');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileDisplayCount, setMobileDisplayCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [recertificationCount, setRecertificationCount] = useState(0);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [pendingAcknowledgeIssue, setPendingAcknowledgeIssue] = useState<Issue | null>(null);
  const openQuickReportModalRef = useRef<(() => void) | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const issuesSectionRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Helper to set filter and scroll to issues section
  const setFilterAndScroll = useCallback((newFilter: 'all' | 'my' | 'overdue') => {
    setFilter(newFilter);
    // Scroll to issues section after a brief delay to allow state update
    setTimeout(() => {
      issuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // Sync issues state with real-time issues
  const issues = realtimeIssues;

  useEffect(() => {
    fetchMetrics();
    fetchUsers();
    fetchRecertificationCount();
  }, []);

  const fetchRecertificationCount = async () => {
    try {
      const response = await fetch('/api/patients/recertification');
      if (!response.ok) return;
      const data = await response.json();
      setRecertificationCount(data.count || 0);
    } catch (error) {
      // Silently fail - user may not be an RN Case Manager
    }
  };

  // Re-fetch metrics when issues count changes (debounced to prevent rapid API calls)
  useEffect(() => {
    if (issues.length > 0) {
      const timeoutId = setTimeout(() => {
        fetchMetrics();
      }, 500); // Debounce 500ms to prevent rapid refetches from real-time updates
      return () => clearTimeout(timeoutId);
    }
  }, [issues.length]); // Only trigger when count changes, not on every array reference change

  // Helper to open issue from URL or notification (handles acknowledgement check)
  const openIssueFromUrl = useCallback((issue: Issue) => {
    // Clear the query param from URL without triggering a reload
    const url = new URL(window.location.href);
    url.searchParams.delete('issue');
    window.history.replaceState({}, '', url.toString());

    // Check if acknowledgement is required
    const requiresAcknowledgement =
      issue.assigned_to === userId &&
      issue.status !== 'resolved' &&
      !issue.acknowledged_at;

    if (requiresAcknowledgement) {
      setPendingAcknowledgeIssue(issue);
      setShowAcknowledgeModal(true);
    } else {
      setSelectedIssue(issue);
      setIsDetailPanelOpen(true);
    }
  }, [userId]);

  // Handle issue query parameter from URL (e.g., from notification click)
  useEffect(() => {
    const issueId = searchParams.get('issue');
    if (issueId && issues.length > 0) {
      // Find the issue in the loaded issues
      const issue = issues.find(i => i.id === issueId);
      if (issue) {
        openIssueFromUrl(issue);
      } else {
        // Issue not in active issues, try to fetch it directly
        fetch(`/api/issues/${issueId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              openIssueFromUrl(data);
            }
          })
          .catch(console.error);
      }
    }
  }, [searchParams, issues, openIssueFromUrl]);

  const fetchMetrics = async () => {
    try {
      const metricsRes = await fetch('/api/metrics').then(r => r.json()).catch(() => null);
      setMetrics(metricsRes);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all staff (coordinators and clinicians) for assignment dropdown
      const response = await fetch('/api/users?all=true');
      if (!response.ok) {
        // Silently handle auth errors - user might not be logged in yet
        setAvailableUsers([]);
        return;
      }
      const data = await response.json();
      // API returns { users: [...] }
      setAvailableUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      // Silently fail for network errors during initial load
      setAvailableUsers([]);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId
        })
      });

      if (response.ok) {
        toast.success('Issue marked as resolved', {
          description: 'Moved to archive'
        });
        setIsDetailPanelOpen(false);
        // Real-time subscription will automatically update, but refresh for safety
        refreshIssues();
      } else {
        toast.error('Failed to resolve issue');
      }
    } catch (error) {
      console.error('Error resolving issue:', error);
      toast.error('Failed to resolve issue');
    }
  };

  const handleAssignIssue = async (issueId: string, assigneeId: string) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assigneeId })
      });

      if (response.ok) {
        toast.success('Issue assigned successfully');
        refreshIssues();
      } else {
        toast.error('Failed to assign issue');
      }
    } catch (error) {
      console.error('Error assigning issue:', error);
      toast.error('Failed to assign issue');
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    // Update the selected issue if it's the same one
    if (selectedIssue?.id === issueId) {
      setSelectedIssue(prev => prev ? { ...prev, status: newStatus as IssueStatus } : null);
    }

    // Refresh data - the real-time subscription will handle updates automatically
    await refreshIssues();
  };

  // Handle issue card click - check if acknowledgement is required
  const handleIssueClick = (issue: Issue) => {
    // Check if this issue requires acknowledgement:
    // - Issue is assigned to current user
    // - Issue is not resolved
    // - Issue has not been acknowledged yet
    const requiresAcknowledgement =
      issue.assigned_to === userId &&
      issue.status !== 'resolved' &&
      !issue.acknowledged_at;

    if (requiresAcknowledgement) {
      // Show acknowledgement modal first
      setPendingAcknowledgeIssue(issue);
      setShowAcknowledgeModal(true);
    } else {
      // Open issue detail panel directly
      setSelectedIssue(issue);
      setIsDetailPanelOpen(true);
    }
  };

  // Handle acknowledgement complete - open the issue detail panel
  const handleAcknowledged = (acknowledgedIssue: Issue) => {
    setShowAcknowledgeModal(false);
    setPendingAcknowledgeIssue(null);
    setSelectedIssue(acknowledgedIssue);
    setIsDetailPanelOpen(true);
    refreshIssues(); // Refresh to get updated acknowledgement status
  };

  // Handle acknowledgement cancelled - just close the modal
  const handleAcknowledgeCancelled = () => {
    setShowAcknowledgeModal(false);
    setPendingAcknowledgeIssue(null);
  };

  const getFilteredIssues = () => {
    let filtered = issues;

    if (filter === 'my') {
      filtered = issues.filter(i => i.assigned_to === userId);
    } else if (filter === 'overdue') {
      filtered = issues.filter(i => {
        if (i.status === 'resolved') return false;
        // Use last_activity_at if available (reset when update is added), otherwise fall back to created_at
        const lastActivity = new Date(i.last_activity_at || i.created_at);
        const hoursSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursSince > 24;
      });
    }
    // 'all' filter shows all issues (no additional filtering)

    // Apply type filter if active
    if (typeFilter) {
      filtered = filtered.filter(i => i.issue_type === typeFilter);
    }

    return filtered;
  };

  const filteredIssues = getFilteredIssues();

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setMobileDisplayCount(ITEMS_PER_PAGE_MOBILE);
  }, [filter, typeFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE_DESKTOP);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE_DESKTOP;
  const paginatedIssues = isMobile 
    ? filteredIssues.slice(0, mobileDisplayCount)
    : filteredIssues.slice(startIndex, startIndex + ITEMS_PER_PAGE_DESKTOP);

  // Infinite scroll for mobile
  const loadMoreMobile = useCallback(() => {
    if (isLoadingMore || mobileDisplayCount >= filteredIssues.length) return;
    
    setIsLoadingMore(true);
    setTimeout(() => {
      setMobileDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE_MOBILE, filteredIssues.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, mobileDisplayCount, filteredIssues.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMobile();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile, loadMoreMobile]);

  const handleTypeFilterClick = (type: string) => {
    if (typeFilter === type) {
      setTypeFilter(null);
    } else {
      setTypeFilter(type);
    }
  };

  const clearTypeFilter = () => {
    setTypeFilter(null);
  };

  return (
    <main className="w-full min-h-screen pb-24 md:pb-24 bg-grain">
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-12 space-y-6 md:space-y-12">
        {/* Header */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up"
          style={{ animationDelay: '0ms' }}
        >
          <div className="flex items-center gap-4 flex-1">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
                  Care Coordination
                </h1>
                <ConnectionStatus isConnected={isConnected} />
              </div>
              <p className="text-body text-muted-foreground mt-1 md:mt-2">
                {userRole === 'coordinator' ? 'Coordinator View' : userRole === 'after_hours' ? 'After-Hours View' : 'Clinician View'}
              </p>
            </div>

            {/* New Message Notification Card */}
            {totalUnread > 0 && latestConversation && (
              <Card
                className="ml-auto bg-gradient-to-r from-[#2D7A7A]/10 to-[#2D7A7A]/5 border-[#2D7A7A]/30 cursor-pointer hover:border-[#2D7A7A]/50 hover:shadow-md transition-all hidden md:block"
                onClick={() => router.push(`/${slug}/dashboard/messages?conversation=${latestConversation.id}`)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-[#2D7A7A]/20">
                    <MessageSquare className="w-5 h-5 text-[#2D7A7A]" />
                  </div>
                  <div className="max-w-[200px]">
                    <p className="font-semibold text-[#2D7A7A] text-sm">
                      {totalUnread} New {totalUnread === 1 ? 'Message' : 'Messages'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {latestConversation.name ||
                        (latestConversation.type === 'patient'
                          ? `Patient: ${latestConversation.patient?.first_name || 'Unknown'} ${latestConversation.patient?.last_name || ''}`
                          : 'Direct Message'
                        )
                      }
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-[#2D7A7A] text-white text-xs">
                    View
                  </Badge>
                </div>
              </Card>
            )}
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'coordinator' && (
              <AfterShiftReportModal issues={issues} onSuccess={refreshIssues} />
            )}
          </div>
        </div>

        {/* Mobile New Message Notification */}
        {totalUnread > 0 && latestConversation && (
          <div className="md:hidden animate-in fade-in slide-in-from-top-4 duration-500">
            <Card
              className="bg-gradient-to-r from-[#2D7A7A]/10 to-[#2D7A7A]/5 border-[#2D7A7A]/30 cursor-pointer hover:border-[#2D7A7A]/50 transition-colors"
              onClick={() => router.push(`/${slug}/dashboard/messages?conversation=${latestConversation.id}`)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-[#2D7A7A]/20">
                    <MessageSquare className="w-5 h-5 text-[#2D7A7A]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#2D7A7A]">
                      {totalUnread} New {totalUnread === 1 ? 'Message' : 'Messages'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tap to view in Message Center
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-[#2D7A7A]/30 text-[#2D7A7A] hover:bg-[#2D7A7A]/10 hover:text-[#2D7A7A]"
                >
                  View
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* After Shift Report Banner */}
        {(userRole === 'after_hours' || userRole === 'coordinator') && (
          <AfterShiftReportBanner
            onIssueClick={(issue) => handleIssueClick(issue)}
          />
        )}

        {/* BP Recertification Notification Card */}
        {recertificationCount > 0 && (
          <div
            className="animate-in fade-in slide-in-from-top-4 duration-500"
            style={{ animationDelay: '50ms' }}
          >
            <Card
              className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-500/30 cursor-pointer hover:border-amber-500/50 transition-colors"
              onClick={() => router.push(`/${slug}/dashboard/recertification`)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/20">
                    <FileCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-700">
                      {recertificationCount} {recertificationCount === 1 ? 'patient requires' : 'patients require'} BP Recertification
                    </p>
                    <p className="text-sm text-muted-foreground">
                      These patients have 7 days or less remaining in their current benefit period
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-amber-500/30 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/${slug}/dashboard/recertification`);
                  }}
                >
                  View Patients
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Overdue Issues Alert Banner */}
        {metrics && metrics.overdueIssues > 0 && (
          <div
            className="animate-in fade-in slide-in-from-top-4 duration-500"
            style={{ animationDelay: '50ms' }}
          >
            <Card
              className="bg-gradient-to-r from-[#E63946]/10 to-[#E63946]/5 border-[#E63946]/30 cursor-pointer hover:border-[#E63946]/50 transition-colors"
              onClick={() => setFilterAndScroll('overdue')}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-[#E63946]/20">
                    <AlertCircle className="w-5 h-5 text-[#E63946]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#E63946]">
                      {metrics.overdueIssues} {metrics.overdueIssues === 1 ? 'Issue' : 'Issues'} Overdue
                    </p>
                    <p className="text-sm text-muted-foreground">
                      These issues have been open for more than 24 hours and require immediate attention
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-[#E63946]/30 text-[#E63946] hover:bg-[#E63946]/10 hover:text-[#E63946]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterAndScroll('overdue');
                  }}
                >
                  View Overdue
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Bento Grid Layout - Primary Metrics */}
        {isLoading && !metrics ? (
          <>
            <div className="md:hidden -mx-4">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 px-4 pb-4">
                  <div className="w-[280px] flex-shrink-0"><MetricCardSkeleton /></div>
                  <div className="w-[280px] flex-shrink-0"><MetricCardSkeleton /></div>
                  <div className="w-[280px] flex-shrink-0"><MetricCardSkeleton /></div>
                  <div className="w-[280px] flex-shrink-0"><MetricCardSkeleton /></div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </div>
          </>
        ) : metrics && (
          <>
            {/* Mobile: Horizontal scroll for metrics */}
            <div className="md:hidden -mx-4">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 px-4 pb-4">
                  <div className="w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
                    <MetricCard
                      title="Open Issues"
                      value={metrics.openIssues}
                      subtitle={`of ${metrics.totalIssues} total`}
                      icon={Clock}
                      onClick={() => setFilterAndScroll('all')}
                    />
                  </div>
                  <div className="w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                    <MetricCard
                      title="Overdue"
                      value={metrics.overdueIssues}
                      subtitle="Require immediate attention"
                      icon={AlertCircle}
                      onClick={() => setFilterAndScroll('overdue')}
                      className="border-l-4 border-l-[hsl(var(--status-overdue))]"
                    />
                  </div>
                  <div className="w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
                    <MetricCard
                      title="Resolved Today"
                      value={metrics.resolvedToday}
                      subtitle="Issues closed"
                      icon={CheckCircle2}
                    />
                  </div>
                  <div className="w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
                    <MetricCard
                      title="Avg Resolution"
                      value={`${metrics.avgResolutionTime.toFixed(1)}h`}
                      subtitle="Average time to resolve"
                      icon={TrendingUp}
                    />
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Desktop: Grid layout for metrics */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
                <MetricCard
                  title="Open Issues"
                  value={metrics.openIssues}
                  subtitle={`of ${metrics.totalIssues} total`}
                  icon={Clock}
                  onClick={() => setFilterAndScroll('all')}
                />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                <MetricCard
                  title="Overdue"
                  value={metrics.overdueIssues}
                  subtitle="Require immediate attention"
                  icon={AlertCircle}
                  onClick={() => setFilterAndScroll('overdue')}
                  className="border-l-4 border-l-[hsl(var(--status-overdue))]"
                />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
                <MetricCard
                  title="Resolved Today"
                  value={metrics.resolvedToday}
                  subtitle="Issues closed"
                  icon={CheckCircle2}
                />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
                <MetricCard
                  title="Avg Resolution"
                  value={`${metrics.avgResolutionTime.toFixed(1)}h`}
                  subtitle="Average time to resolve"
                  icon={TrendingUp}
                />
              </div>
            </div>
          </>
        )}

        {/* Bento Grid Layout - Analytics & Insights */}
        {isLoading && !metrics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        ) : metrics && (
          <ErrorBoundary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Issues by Type Chart */}
            <div 
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '500ms' }}
            >
              <IssuesByTypeChart
                data={metrics.issuesByType || []}
                onTypeClick={handleTypeFilterClick}
                onAddIssue={() => openQuickReportModalRef.current?.()}
              />
            </div>

            {/* Team Responsiveness - Always shown for all user roles */}
            <div
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '600ms' }}
            >
              <ClinicianResponsiveness
                data={metrics.clinicianResponsiveness || []}
                onClinicianClick={(userId) => {
                  setFilter('all');
                  setTypeFilter(null);
                  // Could add clinician-specific filtering here
                }}
              />
            </div>
          </div>
          </ErrorBoundary>
        )}

        {/* Issues List */}
        <div
          ref={issuesSectionRef}
          className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: '700ms' }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <h2
                className="text-xl md:text-2xl font-bold"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Active Issues
              </h2>
              {typeFilter && (
                <Badge 
                  variant="secondary" 
                  className="gap-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => setTypeFilter(null)}
                  style={{ backgroundColor: `${ISSUE_TYPE_COLORS[typeFilter]}20`, color: ISSUE_TYPE_COLORS[typeFilter] }}
                >
                  {typeFilter}
                  <X className="w-3 h-3" />
                </Badge>
              )}
              <span className="text-xs md:text-sm text-muted-foreground">
                ({filteredIssues.length} {filteredIssues.length === 1 ? 'issue' : 'issues'})
              </span>
              <Link href="/dashboard/archive">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Archive className="w-3 h-3" />
                  View Archive
                </Button>
              </Link>
            </div>
            
            {/* Mobile: Horizontal scroll tabs */}
            <div className="w-full sm:w-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
                <TabsList className="inline-flex w-auto">
                  <TabsTrigger value="my" className="text-xs md:text-sm px-2 md:px-3">My Issues</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs md:text-sm px-2 md:px-3">All Issues</TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs md:text-sm px-2 md:px-3">Overdue Issues</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="h-40 md:h-48 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredIssues.length === 0 ? (
            <Card className="p-8 md:p-12 text-center">
              <p className="text-muted-foreground">No issues found</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {paginatedIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onClick={() => handleIssueClick(issue)}
                    onMessageClick={async (e) => {
                      e.stopPropagation();
                      // Navigate to Message Center with patient's group chat
                      if (issue.patient_id) {
                        try {
                          const response = await fetch(`/api/conversations/by-patient/${issue.patient_id}`);
                          if (response.ok) {
                            const data = await response.json();
                            if (data.conversation?.id) {
                              router.push(`/${slug}/dashboard/messages?conversation=${data.conversation.id}`);
                            } else {
                              router.push(`/${slug}/dashboard/messages`);
                            }
                          } else {
                            router.push(`/${slug}/dashboard/messages`);
                          }
                        } catch (error) {
                          router.push(`/${slug}/dashboard/messages`);
                        }
                      } else {
                        router.push(`/${slug}/dashboard/messages`);
                      }
                    }}
                    onResolve={() => handleResolveIssue(issue.id)}
                  />
                ))}
              </div>

              {/* Desktop/Tablet Pagination */}
              {!isMobile && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "ghost"}
                          size="sm"
                          className={cn(
                            "w-8 h-8 p-0",
                            currentPage === pageNum && "bg-[#2D7A7A] hover:bg-[#236060]"
                          )}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Mobile Infinite Scroll Loader */}
              {isMobile && mobileDisplayCount < filteredIssues.length && (
                <div 
                  ref={loaderRef}
                  className="flex justify-center py-8"
                >
                  {isLoadingMore ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-[#2D7A7A] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Scroll for more</span>
                  )}
                </div>
              )}

              {/* Mobile: End of list indicator */}
              {isMobile && mobileDisplayCount >= filteredIssues.length && filteredIssues.length > ITEMS_PER_PAGE_MOBILE && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  You've reached the end • <Link href="/dashboard/archive" className="text-[#2D7A7A] hover:underline">View Archive</Link>
                </div>
              )}
            </>
          )}
        </div>


      </div>

      {/* Floating Action Button with Quick Report Modal */}
      <QuickReportModal
        userId={userId}
        userRole={userRole}
        onSuccess={() => {
          refreshIssues();
        }}
        onExternalTriggerSet={(trigger) => {
          openQuickReportModalRef.current = trigger;
        }}
      />

      <IssueDetailPanel
        issue={selectedIssue}
        open={isDetailPanelOpen}
        onOpenChange={setIsDetailPanelOpen}
        onResolve={handleResolveIssue}
        onAssign={handleAssignIssue}
        onStatusChange={handleStatusChange}
        currentUserId={userId}
        userRole={userRole}
        availableUsers={availableUsers}
        slug={slug}
      />

      {/* Acknowledgement Modal - blocks issue detail view until acknowledged */}
      <IssueAcknowledgeModal
        issue={pendingAcknowledgeIssue}
        open={showAcknowledgeModal}
        onOpenChange={setShowAcknowledgeModal}
        onAcknowledged={handleAcknowledged}
        onCancel={handleAcknowledgeCancelled}
      />
    </main>
  );
}
