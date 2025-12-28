'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, User, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, CheckCircle2, Archive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import { IssueDetailPanel } from '@/components/care/issue-detail-panel';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Handoff, Issue } from '@/types/care-coordination';

export default function AfterShiftReportsPage() {
  const router = useRouter();
  const [handoffs, setHandoffs] = useState<(Handoff & { taggedIssues?: Issue[] })[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    const initUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(userProfile);

      const { data: users } = await supabase.from('users').select('*');
      setAvailableUsers(users || []);

      fetchReports();
    };
    initUser();
  }, [router]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/handoffs');
      if (!response.ok) {
        setHandoffs([]);
        return;
      }
      const data = await response.json();

      if (!Array.isArray(data)) {
        setHandoffs([]);
        return;
      }

      const handoffsWithIssues = await Promise.all(
        data.map(async (handoff: Handoff) => {
          try {
            if (handoff.tagged_issues && handoff.tagged_issues.length > 0) {
              const issuesResponse = await fetch(`/api/handoffs/${handoff.id}/issues`);
              if (issuesResponse.ok) {
                const issues = await issuesResponse.json();
                return { ...handoff, taggedIssues: issues };
              }
            }
          } catch (e) {
            // Ignore individual fetch errors
          }
          return { ...handoff, taggedIssues: [] };
        })
      );

      setHandoffs(handoffsWithIssues);
    } catch (error) {
      setHandoffs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveReport = async (reportId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('handoffs')
        .update({ is_archived: true })
        .eq('id', reportId);

      if (error) throw error;

      setHandoffs(prevHandoffs =>
        prevHandoffs.map(h =>
          h.id === reportId ? { ...h, is_archived: true } : h
        )
      );
      setExpandedId(null);
    } catch (error) {
      console.error('Error archiving report:', error);
    }
  };

  // Sort issues by priority helper
  const sortIssuesByPriority = (issues: Issue[]) => {
    const urgent = issues.filter(i => i.priority === 'urgent');
    const high = issues.filter(i => i.priority === 'high');
    const rest = issues.filter(i => i.priority !== 'urgent' && i.priority !== 'high');

    const groupedByType: Record<string, Issue[]> = {};
    rest.forEach(issue => {
      if (!groupedByType[issue.issue_type]) {
        groupedByType[issue.issue_type] = [];
      }
      groupedByType[issue.issue_type].push(issue);
    });

    Object.keys(groupedByType).forEach(type => {
      groupedByType[type].sort((a, b) => {
        const priorityOrder: Record<string, number> = { normal: 0, low: 1 };
        return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
      });
    });

    return { urgent, high, groupedByType };
  };

  const isOverdue = (issue: Issue) => {
    const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSince > 24 && issue.status !== 'resolved';
  };

  const renderIssueCard = (issue: Issue) => {
    const overdue = isOverdue(issue);
    return (
      <Card
        key={issue.id}
        className="p-3 cursor-pointer hover:shadow-md transition-all"
        onClick={() => {
          setSelectedIssue(issue);
          setIsDetailPanelOpen(true);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium truncate">
                {issue.patient?.first_name} {issue.patient?.last_name}
              </p>
              <Badge variant="secondary" className="text-xs shrink-0">
                {issue.issue_type}
              </Badge>
              {overdue && (
                <Badge variant="outline" className="text-xs bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F] shrink-0">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
            {issue.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {issue.description}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-xs capitalize ml-3 shrink-0">
            {issue.status.replace('_', ' ')}
          </Badge>
        </div>
      </Card>
    );
  };

  const renderReportCard = (handoff: Handoff & { taggedIssues?: Issue[] }, isArchived: boolean = false) => {
    const isExpanded = expandedId === handoff.id;
    const canArchive = handoff.taggedIssues?.every(i => i.status === 'resolved') ?? false;
    const sortedIssues = handoff.taggedIssues ? sortIssuesByPriority(handoff.taggedIssues) : null;

    return (
      <Card
        key={handoff.id}
        className={cn(
          'overflow-hidden transition-all',
          isArchived && 'opacity-75'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50"
          onClick={() => setExpandedId(isExpanded ? null : handoff.id)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className={cn(
              "p-3 rounded-full",
              isArchived ? "bg-muted" : "bg-[#2D7A7A]/10"
            )}>
              {isArchived ? (
                <Archive className="w-6 h-6 text-muted-foreground" />
              ) : (
                <FileText className="w-6 h-6 text-[#2D7A7A]" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className={cn(
                  "font-semibold text-lg",
                  isArchived && "text-muted-foreground"
                )} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  After Shift Report {isArchived && '(Archived)'}
                </h3>
                {handoff.taggedIssues && handoff.taggedIssues.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {handoff.taggedIssues.length} issues
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {handoff.creator && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{handoff.creator.name || handoff.creator.email?.split('@')[0]}</span>
                  </div>
                )}
                <span className="text-xs">
                  {formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-[#D4D4D4] p-6 pt-4 space-y-4 bg-[#FAFAF8]/50">
            {/* Notes */}
            {handoff.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Report Notes
                </p>
                <Card className="p-4 bg-white">
                  <p className="text-sm whitespace-pre-wrap">{handoff.notes}</p>
                </Card>
              </div>
            )}

            {/* Tagged Issues */}
            {sortedIssues && handoff.taggedIssues && handoff.taggedIssues.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Tagged Issues ({handoff.taggedIssues.length})
                </p>
                <div className="space-y-4">
                  {/* Urgent Issues */}
                  {sortedIssues.urgent.length > 0 && (
                    <Card className="p-4 bg-red-50 border-2 border-red-500">
                      <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Urgent ({sortedIssues.urgent.length})
                      </h4>
                      <div className="space-y-2">
                        {sortedIssues.urgent.map(renderIssueCard)}
                      </div>
                    </Card>
                  )}

                  {/* High Priority Issues */}
                  {sortedIssues.high.length > 0 && (
                    <Card className="p-4 bg-orange-50 border-2 border-orange-500">
                      <h4 className="font-bold text-orange-700 mb-3 flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        High Priority ({sortedIssues.high.length})
                      </h4>
                      <div className="space-y-2">
                        {sortedIssues.high.map(renderIssueCard)}
                      </div>
                    </Card>
                  )}

                  {/* Issues by Type */}
                  {Object.entries(sortedIssues.groupedByType).map(([type, typeIssues]) => (
                    <div key={type}>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">
                        {type} ({typeIssues.length})
                      </h4>
                      <div className="space-y-2">
                        {typeIssues.map(renderIssueCard)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            {!isArchived && (
              <div className="flex items-center justify-end pt-4 border-t">
                {canArchive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveReport(handoff.id);
                    }}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    Archive
                  </Button>
                )}
              </div>
            )}

            {isArchived && (
              <div className="flex items-center justify-end pt-4 border-t">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <Archive className="w-3 h-3 mr-1" />
                  Archived
                </Badge>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <>
      <DashboardNavbar />
      <main className="min-h-screen bg-[#FAFAF8] p-4 md:p-6 pb-24 md:pb-6">
        <div className="container mx-auto space-y-6 md:space-y-8">
          {/* Header */}
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold text-[#1A1A1A]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              After Shift Reports
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View and manage shift reports
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'archived')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            {/* Active Reports */}
            <TabsContent value="active" className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-32 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : handoffs.filter(h => !h.is_archived).length === 0 ? (
                <Card className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No active reports</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {handoffs.filter(h => !h.is_archived).map((handoff) => renderReportCard(handoff, false))}
                </div>
              )}
            </TabsContent>

            {/* Archived Reports */}
            <TabsContent value="archived" className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-32 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : handoffs.filter(h => h.is_archived).length === 0 ? (
                <Card className="p-12 text-center">
                  <Archive className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No archived reports</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {handoffs.filter(h => h.is_archived).map((handoff) => renderReportCard(handoff, true))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selectedIssue}
        open={isDetailPanelOpen}
        onOpenChange={(open) => {
          setIsDetailPanelOpen(open);
          if (!open) setSelectedIssue(null);
        }}
        onResolve={(issueId) => {
          setHandoffs(prevHandoffs =>
            prevHandoffs.map(h => ({
              ...h,
              taggedIssues: h.taggedIssues?.map(i =>
                i.id === issueId ? { ...i, status: 'resolved' as const } : i
              )
            }))
          );
        }}
        onAssign={() => {
          // Handle assignment if needed
        }}
        currentUserId={currentUser?.id || ''}
        userRole={currentUser?.role || 'clinician'}
        availableUsers={availableUsers}
      />

      <MobileBottomNav />
    </>
  );
}
