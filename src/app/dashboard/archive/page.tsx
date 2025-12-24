'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Archive, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Filter,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ISSUE_TYPE_COLORS, type Issue } from '@/types/care-coordination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IssueDetailPanel } from '@/components/care/issue-detail-panel';
import { createClient } from '../../../../supabase/client';

const ITEMS_PER_PAGE_DESKTOP = 6; // 3 columns x 2 rows
const ITEMS_PER_PAGE_MOBILE = 5;

export default function ArchivePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [mobileDisplayCount, setMobileDisplayCount] = useState(ITEMS_PER_PAGE_MOBILE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const isMobile = useIsMobile();
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch resolved issues
  useEffect(() => {
    const fetchResolvedIssues = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/issues?status=resolved&includeResolved=true');
        if (response.ok) {
          const data = await response.json();
          setIssues(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching archived issues:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(profile);
      }
    };

    const fetchAvailableUsers = async () => {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data);
      }
    };

    fetchResolvedIssues();
    fetchCurrentUser();
    fetchAvailableUsers();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...issues];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(issue => 
        issue.patient?.first_name?.toLowerCase().includes(query) ||
        issue.patient?.last_name?.toLowerCase().includes(query) ||
        issue.description?.toLowerCase().includes(query) ||
        issue.issue_number?.toString().includes(query)
      );
    }

    // Type filter
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(issue => issue.issue_type === typeFilter);
    }

    setFilteredIssues(filtered);
    setCurrentPage(1);
    setMobileDisplayCount(ITEMS_PER_PAGE_MOBILE);
  }, [issues, searchQuery, typeFilter]);

  // Infinite scroll for mobile
  const loadMoreMobile = useCallback(() => {
    if (isLoadingMore || mobileDisplayCount >= filteredIssues.length) return;
    
    setIsLoadingMore(true);
    // Simulate loading delay for smoother UX
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

  // Pagination for desktop
  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE_DESKTOP);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE_DESKTOP;
  const paginatedIssues = isMobile 
    ? filteredIssues.slice(0, mobileDisplayCount)
    : filteredIssues.slice(startIndex, startIndex + ITEMS_PER_PAGE_DESKTOP);

  // Get unique issue types for filter
  const issueTypes = Array.from(new Set(issues.map(issue => issue.issue_type)));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <main className="w-full min-h-screen pb-24 md:pb-24 bg-grain">
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-12 space-y-6 md:space-y-8">
        {/* Back Link */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in-up"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <Archive className="w-8 h-8 text-[#81B29A]" />
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Archive
            </h1>
          </div>
          <p className="text-body text-muted-foreground">
            Resolved issues are stored here for reference
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, issue #, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {issueTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-[#81B29A]" />
            {filteredIssues.length} resolved issue{filteredIssues.length !== 1 ? 's' : ''}
          </span>
          {!isMobile && totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>

        {/* Issues Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-4 md:p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredIssues.length === 0 ? (
          <Card className="p-8 md:p-12 text-center">
            <Archive className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || typeFilter !== 'all' 
                ? 'No resolved issues match your filters' 
                : 'No resolved issues yet'}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {paginatedIssues.map((issue) => (
                <Card 
                  key={issue.id} 
                  className={cn(
                    "p-4 md:p-6 border-l-4 transition-all hover:shadow-md cursor-pointer",
                    "border-l-[#81B29A]"
                  )}
                  onClick={() => {
                    setSelectedIssue(issue);
                    setIsDetailPanelOpen(true);
                  }}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-mono text-muted-foreground">
                          #{issue.issue_number}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className="text-xs truncate"
                          style={{ 
                            backgroundColor: `${ISSUE_TYPE_COLORS[issue.issue_type] || '#6B7280'}15`,
                            color: ISSUE_TYPE_COLORS[issue.issue_type] || '#6B7280'
                          }}
                        >
                          {issue.issue_type}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="bg-[#81B29A]/15 text-[#81B29A] shrink-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Resolved
                      </Badge>
                    </div>

                    {/* Patient */}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {issue.patient?.first_name} {issue.patient?.last_name}
                      </span>
                    </div>

                    {/* Description */}
                    {issue.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {issue.description}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(issue.created_at)}</span>
                      </div>
                      {issue.resolved_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Resolved {formatDate(issue.resolved_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Pagination */}
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-8 h-8 p-0",
                        currentPage === page && "bg-[#2D7A7A] hover:bg-[#236060]"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
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
                You've reached the end
              </div>
            )}
          </>
        )}
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
          setIssues(prevIssues => 
            prevIssues.map(issue => 
              issue.id === issueId ? { ...issue, status: 'resolved' as const } : issue
            )
          );
        }}
        onAssign={(issueId, userId) => {
          // Handle assignment if needed
        }}
        currentUserId={currentUser?.id || ''}
        userRole={currentUser?.role || 'clinician'}
        availableUsers={availableUsers}
      />
    </main>
  );
}
