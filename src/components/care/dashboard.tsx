'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { IssueStatus } from '@/types/care-coordination';
import { Clock, AlertCircle, CheckCircle2, TrendingUp, MessageSquare, X, Keyboard, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import Link from 'next/link';
import { MetricCard } from './metric-card';
import { QuickReportModal } from './quick-report-modal';
import { IssueDetailPanel } from './issue-detail-panel';
import { CommunicationPanel } from './communication-panel';
import { MobileCommunicationSheet } from './mobile-communication-sheet';
import { HandoffModal } from './handoff-modal';
import { HandoffBanner } from './handoff-banner';
import { ClinicianResponsiveness } from './clinician-responsiveness';
import { ReportGenerator } from './report-generator';
import { IssuesByTypeChart } from './issues-by-type-chart';
import { IssueCard } from './issue-card';
import { ConnectionStatus } from './connection-status';
import { IssueCardSkeleton, MetricCardSkeleton, ChartSkeleton } from './loading-skeletons';
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
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ITEMS_PER_PAGE_DESKTOP = 6; // 3 columns x 2 rows
const ITEMS_PER_PAGE_MOBILE = 5;

interface CareCoordinationDashboardProps {
  userId: string;
  userRole: string;
}

export function CareCoordinationDashboard({ userId, userRole }: CareCoordinationDashboardProps) {
  const { issues: realtimeIssues, isConnected, isLoading, refreshIssues } = useRealtimeIssues();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isCommunicationPanelOpen, setIsCommunicationPanelOpen] = useState(false);
  const [communicationIssue, setCommunicationIssue] = useState<Issue | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'my' | 'open' | 'overdue'>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileDisplayCount, setMobileDisplayCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      metaKey: true,
      callback: () => setFilter('all'),
      description: 'Show all issues',
    },
    {
      key: 'n',
      metaKey: true,
      callback: () => document.querySelector<HTMLButtonElement>('[aria-label="Report new issue"]')?.click(),
      description: 'New issue',
    },
    {
      key: '?',
      shiftKey: true,
      callback: () => setShowShortcuts(true),
      description: 'Show keyboard shortcuts',
    },
    {
      key: 'Escape',
      callback: () => {
        setIsDetailPanelOpen(false);
        setIsCommunicationPanelOpen(false);
        setShowShortcuts(false);
      },
      description: 'Close panels',
    },
  ]);

  // Sync issues state with real-time issues
  const issues = realtimeIssues;

  useEffect(() => {
    fetchMetrics();
    fetchUsers();
  }, []);

  // Re-fetch metrics when issues change
  useEffect(() => {
    if (issues.length > 0) {
      fetchMetrics();
    }
  }, [issues]);

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
      const response = await fetch('/api/users');
      if (!response.ok) {
        // Silently handle auth errors - user might not be logged in yet
        setAvailableUsers([]);
        return;
      }
      const users = await response.json();
      setAvailableUsers(Array.isArray(users) ? users : []);
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

  const getFilteredIssues = () => {
    let filtered = issues;

    if (filter === 'my') {
      filtered = issues.filter(i => i.assigned_to === userId);
    } else if (filter === 'open') {
      filtered = issues.filter(i => i.status === 'open' || i.status === 'in_progress');
    } else if (filter === 'overdue') {
      filtered = issues.filter(i => {
        if (i.status === 'resolved') return false;
        const createdAt = new Date(i.created_at);
        const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursSince > 24;
      });
    }

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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcuts(true)}
              className="hidden md:flex items-center gap-2"
            >
              <Keyboard className="h-4 w-4" />
              Shortcuts
            </Button>
            {userRole === 'coordinator' && (
              <HandoffModal issues={issues} onSuccess={refreshIssues} />
            )}
          </div>
        </div>

        {/* After-Hours Handoff Banner */}
        {(userRole === 'after_hours' || userRole === 'coordinator') && (
          <HandoffBanner 
            onIssueClick={(issue) => {
              setSelectedIssue(issue);
              setIsDetailPanelOpen(true);
            }}
          />
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
                      onClick={() => setFilter('open')}
                    />
                  </div>
                  <div className="w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                    <MetricCard
                      title="Overdue"
                      value={metrics.overdueIssues}
                      subtitle="Require immediate attention"
                      icon={AlertCircle}
                      onClick={() => setFilter('overdue')}
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
                  onClick={() => setFilter('open')}
                />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                <MetricCard
                  title="Overdue"
                  value={metrics.overdueIssues}
                  subtitle="Require immediate attention"
                  icon={AlertCircle}
                  onClick={() => setFilter('overdue')}
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
              />
            </div>

            {/* Clinician Responsiveness or Report Generator */}
            {userRole === 'coordinator' && metrics.clinicianResponsiveness && metrics.clinicianResponsiveness.length > 0 ? (
              <div 
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: '600ms' }}
              >
                <ClinicianResponsiveness
                  data={metrics.clinicianResponsiveness}
                  onClinicianClick={(userId) => {
                    setFilter('all');
                    setTypeFilter(null);
                    // Could add clinician-specific filtering here
                  }}
                />
              </div>
            ) : (
              <div 
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: '600ms' }}
              >
                <ReportGenerator issues={issues} metrics={metrics} />
              </div>
            )}
          </div>
          </ErrorBoundary>
        )}

        {/* Issues List */}
        <div 
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
                  <TabsTrigger value="all" className="text-xs md:text-sm px-2 md:px-3">All</TabsTrigger>
                  <TabsTrigger value="my" className="text-xs md:text-sm px-2 md:px-3">My Issues</TabsTrigger>
                  <TabsTrigger value="open" className="text-xs md:text-sm px-2 md:px-3">Open</TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs md:text-sm px-2 md:px-3">Overdue</TabsTrigger>
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
                    onClick={() => {
                      setSelectedIssue(issue);
                      setIsDetailPanelOpen(true);
                    }}
                    onMessageClick={(e) => {
                      e.stopPropagation();
                      setCommunicationIssue(issue);
                      setIsCommunicationPanelOpen(true);
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
        onSuccess={() => {
          refreshIssues();
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
      />

      {/* Floating Communication Panel - Desktop */}
      {isCommunicationPanelOpen && !isMobile && (
        <div className="fixed bottom-24 right-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <CommunicationPanel
            issue={communicationIssue}
            currentUserId={userId}
            onClose={() => {
              setIsCommunicationPanelOpen(false);
              setCommunicationIssue(null);
            }}
            defaultExpanded={true}
            position="right"
          />
        </div>
      )}

      {/* Mobile Communication Bottom Sheet */}
      {isMobile && (
        <MobileCommunicationSheet
          issue={communicationIssue}
          currentUserId={userId}
          open={isCommunicationPanelOpen}
          onOpenChange={(open) => {
            setIsCommunicationPanelOpen(open);
            if (!open) setCommunicationIssue(null);
          }}
        />
      )}

      {/* Quick Message Button - shows when communication panel is closed but an issue is selected */}
      {!isCommunicationPanelOpen && selectedIssue && (
        <Button
          onClick={() => {
            setCommunicationIssue(selectedIssue);
            setIsCommunicationPanelOpen(true);
          }}
          className="fixed bottom-24 right-24 md:right-24 z-40 h-12 w-12 rounded-full bg-[#2D7A7A] hover:bg-[#236060] shadow-lg active:scale-95 transition-transform touch-manipulation"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">New Issue</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded">⌘ N</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Show All Issues</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded">⌘ K</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Close Panel</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded">Esc</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Show Shortcuts</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded">?</kbd>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Mobile:</strong> Swipe right on issue cards to mark as resolved
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
