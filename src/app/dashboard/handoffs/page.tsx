'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Moon, Clock, User, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';
import { createClient } from '../../../../supabase/client';
import { cn } from '@/lib/utils';
import type { Handoff, Issue } from '@/types/care-coordination';

export default function HandoffsPage() {
  const router = useRouter();
  const [handoffs, setHandoffs] = useState<(Handoff & { taggedIssues?: Issue[] })[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initUser = async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
        return;
      }
      fetchHandoffs();
    };
    initUser();
  }, [router]);

  const fetchHandoffs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/handoffs');
      if (!response.ok) {
        // Silently fail - no handoffs is normal
        setHandoffs([]);
        return;
      }
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        setHandoffs([]);
        return;
      }
      
      // Fetch tagged issues for each handoff
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
      // Network errors are expected in some environments - fail silently
      setHandoffs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getHandoffStatus = (handoff: Handoff) => {
    const now = new Date();
    const start = new Date(handoff.shift_start);
    const end = new Date(handoff.shift_end);

    if (isPast(end)) return 'completed';
    if (isFuture(start)) return 'upcoming';
    return 'active';
  };

  const statusColors = {
    active: 'bg-[#2D7A7A] text-white',
    upcoming: 'bg-blue-500 text-white',
    completed: 'bg-[#81B29A] text-white',
  };

  const statusLabels = {
    active: 'Active Now',
    upcoming: 'Upcoming',
    completed: 'Completed',
  };

  const issueStatusColors = {
    open: 'border-l-[#2D7A7A]',
    in_progress: 'border-l-blue-500',
    resolved: 'border-l-[#81B29A]',
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
              After-Hours Handoffs
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View and manage shift handoff reports
            </p>
          </div>

          {/* Handoffs List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted" />
              ))}
            </div>
          ) : handoffs.length === 0 ? (
            <Card className="p-12 text-center">
              <Moon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No handoffs created yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {handoffs.map((handoff) => {
                const status = getHandoffStatus(handoff);
                const isExpanded = expandedId === handoff.id;
                const isOverdue = (issue: Issue) => {
                  const hoursSince = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60);
                  return hoursSince > 24 && issue.status !== 'resolved';
                };

                return (
                  <Card
                    key={handoff.id}
                    className={cn(
                      'overflow-hidden transition-all',
                      status === 'active' && 'ring-2 ring-[#2D7A7A] ring-offset-2'
                    )}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : handoff.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-3 rounded-full bg-[#2D7A7A]/10">
                          <Moon className="w-6 h-6 text-[#2D7A7A]" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                              Handoff Report
                            </h3>
                            <Badge className={statusColors[status]}>
                              {statusLabels[status]}
                            </Badge>
                            {handoff.taggedIssues && handoff.taggedIssues.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {handoff.taggedIssues.length} issues
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>
                                {format(new Date(handoff.shift_start), 'MMM d, h:mm a')} — {format(new Date(handoff.shift_end), 'h:mm a')}
                              </span>
                            </div>
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
                              Handoff Notes
                            </p>
                            <Card className="p-4 bg-white">
                              <p className="text-sm whitespace-pre-wrap">{handoff.notes}</p>
                            </Card>
                          </div>
                        )}

                        {/* Tagged Issues */}
                        {handoff.taggedIssues && handoff.taggedIssues.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                              Tagged Issues ({handoff.taggedIssues.length})
                            </p>
                            <div className="space-y-2">
                              {handoff.taggedIssues.map((issue) => {
                                const overdue = isOverdue(issue);
                                return (
                                  <Card
                                    key={issue.id}
                                    className={cn(
                                      'p-4 border-l-4 cursor-pointer hover:shadow-md transition-all',
                                      issueStatusColors[issue.status as keyof typeof issueStatusColors]
                                    )}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-mono text-xs text-muted-foreground">
                                            #{issue.issue_number}
                                          </span>
                                          <Badge variant="secondary" className="text-xs">
                                            {issue.issue_type}
                                          </Badge>
                                          {overdue && (
                                            <Badge variant="outline" className="text-xs bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]">
                                              <AlertCircle className="w-3 h-3 mr-1" />
                                              Overdue
                                            </Badge>
                                          )}
                                          <Badge variant="outline" className="text-xs capitalize">
                                            {issue.status.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                        <p className="text-sm font-medium">
                                          {issue.patient?.first_name} {issue.patient?.last_name}
                                        </p>
                                        {issue.notes && (
                                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {issue.notes}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shift Summary */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            Shift Duration: {Math.round((new Date(handoff.shift_end).getTime() - new Date(handoff.shift_start).getTime()) / (1000 * 60 * 60))} hours
                          </div>
                          {status === 'completed' && (
                            <Badge variant="outline" className="text-xs text-[#81B29A] border-[#81B29A]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Shift Completed
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <MobileBottomNav />
    </>
  );
}
