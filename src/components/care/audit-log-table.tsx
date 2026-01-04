'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Filter, Search, X, FileText, Printer, ExternalLink } from 'lucide-react';
import { IssueDetailPanel } from '@/components/care/issue-detail-panel';
import type { Issue } from '@/types/care-coordination';
import { createClient } from '../../../supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditLogEntry {
  id: string;
  issue_id: string | null;
  user_id: string | null;
  action: string;
  details: any;
  created_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  assigned_to_user?: {
    id: string;
    email: string;
    name?: string;
  };
  issue?: {
    id: string;
    issue_number: number;
    status: string;
    patient?: {
      id: string;
      first_name: string;
      last_name: string;
    };
  };
}

interface AuditLogTableProps {
  issueId?: string;
}

const actionColors: Record<string, string> = {
  created: 'bg-[#2D7A7A]/10 text-[#2D7A7A]',
  assigned: 'bg-blue-500/10 text-blue-700',
  status_changed: 'bg-orange-500/10 text-orange-700',
  resolved: 'bg-[#81B29A]/10 text-[#81B29A]',
  lifecycle_completed: 'bg-[#81B29A]/10 text-[#81B29A]',
  commented: 'bg-purple-500/10 text-purple-700',
  updated: 'bg-gray-500/10 text-gray-700',
  message_sent: 'bg-indigo-500/10 text-indigo-700',
  handoff_created: 'bg-amber-500/10 text-amber-700',
  after_shift_report_created: 'bg-amber-500/10 text-amber-700',
  patient_created: 'bg-emerald-500/10 text-emerald-700',
};

const actionLabels: Record<string, string> = {
  created: 'Issue Created',
  assigned: 'Assigned',
  status_changed: 'Status Changed',
  resolved: 'Resolved',
  lifecycle_completed: 'Lifecycle Complete',
  commented: 'Commented',
  updated: 'Update Added',
  message_sent: 'Message Sent',
  handoff_created: 'Report Created',
  after_shift_report_created: 'Report Created',
  patient_created: 'Patient Created',
};

export function AuditLogTable({ issueId }: AuditLogTableProps) {
  const pathname = usePathname();
  const facilitySlug = pathname?.split('/')[1] || '';

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [userRole, setUserRole] = useState('clinician');
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email?: string; name?: string }>>([]);

  // Get the link URL for an action based on its type
  const getActionLink = (entry: AuditLogEntry): string | null => {
    switch (entry.action) {
      case 'patient_created':
        // Link to patient page
        if (entry.details?.patient_id) {
          return `/${facilitySlug}/dashboard/patients?patient=${entry.details.patient_id}`;
        }
        return null;
      case 'handoff_created':
      case 'after_shift_report_created':
        // Link directly to the specific report
        if (entry.details?.handoff_id) {
          return `/${facilitySlug}/dashboard/after-shift-reports?report=${entry.details.handoff_id}`;
        }
        return null;
      case 'created':
      case 'assigned':
      case 'status_changed':
      case 'resolved':
      case 'lifecycle_completed':
      case 'updated':
      case 'message_sent':
        // Link to issue via the patient column click (existing behavior)
        return null;
      default:
        return null;
    }
  };

  // Get patient name for display - handles both issue-based and patient_created entries
  const getPatientDisplay = (entry: AuditLogEntry): { name: string; id?: string; isReport?: boolean } | null => {
    // For patient_created entries, get from details
    if (entry.action === 'patient_created' && entry.details) {
      return {
        name: `${entry.details.first_name || ''} ${entry.details.last_name || ''}`.trim() || 'Unknown Patient',
        id: entry.details.patient_id
      };
    }

    // For after-shift report entries, show report info
    if (entry.action === 'after_shift_report_created') {
      const taggedCount = entry.details?.tagged_count || 0;
      return {
        name: `${taggedCount} issue${taggedCount !== 1 ? 's' : ''} tagged`,
        isReport: true
      };
    }

    // For issue-related entries, get from the issue's patient
    if (entry.issue?.patient) {
      return {
        name: `${entry.issue.patient.first_name} ${entry.issue.patient.last_name}`,
        id: entry.issue.patient.id
      };
    }

    return null;
  };

  useEffect(() => {
    fetchAuditLog();
    fetchUserInfo();
    fetchAvailableUsers();
  }, [issueId]);

  useEffect(() => {
    applyFilters();
  }, [entries, searchTerm, actionFilter, userFilter, dateRange]);

  const fetchUserInfo = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (userData?.role) {
        setUserRole(userData.role);
      }
    }
  };

  const fetchAvailableUsers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id, email, name')
      .order('name');
    if (data) {
      setAvailableUsers(data);
    }
  };

  const handlePatientClick = async (issueId: string) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`);
      if (response.ok) {
        const issue = await response.json();
        setSelectedIssue(issue);
        setIsDetailPanelOpen(true);
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      fetchAuditLog();
    } catch (error) {
      console.error('Error resolving issue:', error);
    }
  };

  const handleAssignIssue = async (issueId: string, userId: string) => {
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: userId }),
      });
      fetchAuditLog();
    } catch (error) {
      console.error('Error assigning issue:', error);
    }
  };

  const handleStatusChange = async (issueId: string, status: string) => {
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchAuditLog();
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const fetchAuditLog = async () => {
    setIsLoading(true);
    try {
      const url = issueId ? `/api/audit-log?issueId=${issueId}` : '/api/audit-log';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch');
      }
      const data = await response.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.action.toLowerCase().includes(term) ||
          entry.user?.email?.toLowerCase().includes(term) ||
          entry.issue?.patient?.first_name?.toLowerCase().includes(term) ||
          entry.issue?.patient?.last_name?.toLowerCase().includes(term) ||
          `${entry.issue?.patient?.first_name} ${entry.issue?.patient?.last_name}`.toLowerCase().includes(term) ||
          JSON.stringify(entry.details).toLowerCase().includes(term)
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.action === actionFilter);
    }

    // User filter
    if (userFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.user_id === userFilter);
    }

    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(
        (entry) => new Date(entry.created_at) >= dateRange.from!
      );
    }
    if (dateRange.to) {
      filtered = filtered.filter(
        (entry) => new Date(entry.created_at) <= dateRange.to!
      );
    }

    setFilteredEntries(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setUserFilter('all');
    setDateRange({});
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['Timestamp', 'Patient', 'Action', 'User', 'Details'];
      const rows = filteredEntries.map((entry) => {
        const patientDisplay = getPatientDisplay(entry);
        return [
          format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
          patientDisplay?.name || 'N/A',
          actionLabels[entry.action] || entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          entry.user?.email || 'Unknown User',
          formatDetails(entry.action, entry.details, entry.assigned_to_user),
        ];
      });

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Audit log exported as CSV');
    } catch (error) {
      console.error('Error exporting audit log:', error);
      toast.error('Failed to export audit log');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(26, 26, 26);
      doc.text('Audit Log Report', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      const dateRangeText = dateRange.from && dateRange.to
        ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
        : 'All Time';
      doc.text(`Date Range: ${dateRangeText}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth / 2, 34, { align: 'center' });

      // Summary stats
      const actionCounts: Record<string, number> = {};
      filteredEntries.forEach((entry) => {
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      });

      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text('Summary', 14, 50);

      const summaryData = [
        ['Total Entries', filteredEntries.length.toString()],
        ...Object.entries(actionCounts).map(([action, count]) => [
          actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count.toString()
        ])
      ];

      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Count']],
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [250, 250, 248], textColor: [26, 26, 26], fontStyle: 'bold' },
      });

      // Audit entries table
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Detailed Audit Trail', 14, 20);

      const tableData = filteredEntries.map((entry) => {
        const patientDisplay = getPatientDisplay(entry);
        return [
          format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm'),
          patientDisplay?.name || 'N/A',
          actionLabels[entry.action] || entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          entry.user?.name || entry.user?.email?.split('@')[0] || 'Unknown User',
          formatDetails(entry.action, entry.details, entry.assigned_to_user).substring(0, 60)
        ];
      });

      autoTable(doc, {
        startY: 25,
        head: [['Timestamp', 'Patient', 'Action', 'User', 'Details']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [45, 122, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 248] },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 15 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' }
        }
      });

      // Footer
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(153, 153, 153);
        doc.text(
          `Care Coordination Audit Log | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`audit-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
      toast.success('Audit log exported as PDF');
    } catch (error) {
      console.error('Error exporting audit log:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const setPresetDateRange = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ from: today, to: today });
        break;
      case 'week':
        setDateRange({ from: startOfWeek(today), to: endOfWeek(today) });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case '7days':
        setDateRange({ from: subDays(today, 7), to: today });
        break;
      case '30days':
        setDateRange({ from: subDays(today, 30), to: today });
        break;
    }
  };

  const formatDetails = (action: string, details: any, assignedToUser?: { name?: string; email?: string }) => {
    if (!details) return '';

    switch (action) {
      case 'created':
        return `Type: ${details.issue_type || 'N/A'}`;
      case 'assigned':
        const assigneeName = assignedToUser?.name || assignedToUser?.email?.split('@')[0] || 'Unknown user';
        return `Assigned to ${assigneeName}`;
      case 'status_changed':
        return `${details.old_status?.replace('_', ' ')} → ${details.new_status?.replace('_', ' ')}${details.note ? ` - ${details.note}` : ''}`;
      case 'resolved':
        return 'Issue marked as resolved';
      case 'lifecycle_completed':
        return `Total Lifecycle: ${details.total_lifecycle}`;
      case 'updated':
        return details.note || 'Update added';
      case 'message_sent':
        return `Message: "${details.message?.substring(0, 50)}${details.message?.length > 50 ? '...' : ''}"`;
      case 'handoff_created':
        return `Shift: ${details.shift_start ? format(new Date(details.shift_start), 'MMM d h:mm a') : ''} - ${details.shift_end ? format(new Date(details.shift_end), 'h:mm a') : ''}, ${details.tagged_count || 0} issues tagged`;
      case 'after_shift_report_created':
        return `${details.tagged_count || 0} issues tagged in report`;
      case 'patient_created':
        return `Patient: ${details.first_name} ${details.last_name} (MRN: ${details.mrn || 'N/A'})`;
      default:
        return JSON.stringify(details);
    }
  };

  const uniqueActions = Array.from(new Set(entries.map((e) => e.action)));
  const uniqueUsers = Array.from(
    new Map(
      entries
        .filter((e) => e.user)
        .map((e) => [e.user_id, e.user])
    ).values()
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-6 bg-[#FAFAF8] border-[#D4D4D4]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h3>
            {(searchTerm || actionFilter !== 'all' || userFilter !== 'all' || dateRange.from || dateRange.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search audit log..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-[#D4D4D4]"
              />
            </div>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="border-[#D4D4D4]">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {actionLabels[action] || action.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User Filter */}
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="border-[#D4D4D4]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email?.split('@')[0] || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal border-[#D4D4D4]',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} -{' '}
                        {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Pick a date range'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange(range || {})}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Quick select:</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetDateRange('today')}>Today</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetDateRange('7days')}>Last 7 Days</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetDateRange('30days')}>Last 30 Days</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetDateRange('week')}>This Week</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPresetDateRange('month')}>This Month</Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {filteredEntries.length} of {entries.length} entries
            </p>
            <div className="flex gap-2">
              <Button
                onClick={exportToCSV}
                disabled={isExporting || filteredEntries.length === 0}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={isExporting || filteredEntries.length === 0}
                className="bg-[#2D7A7A] hover:bg-[#236060]"
                size="sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Audit Table */}
      <Card className="border-[#D4D4D4]">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="border-brand-border">
                <TableHead className="font-mono text-audit uppercase tracking-wider">TIMESTAMP</TableHead>
                {!issueId && <TableHead className="font-mono text-audit uppercase tracking-wider">PATIENT</TableHead>}
                <TableHead className="font-mono text-audit uppercase tracking-wider">ACTION</TableHead>
                <TableHead className="font-mono text-audit uppercase tracking-wider">USER</TableHead>
                <TableHead className="font-mono text-audit uppercase tracking-wider">DETAILS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={issueId ? 4 : 5}
                    className="text-center text-muted-foreground py-8"
                  >
                    Loading audit log...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={issueId ? 4 : 5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No audit entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="border-brand-border hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-audit text-muted-foreground">
                      {format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    {!issueId && (
                      <TableCell>
                        {(() => {
                          const patientDisplay = getPatientDisplay(entry);
                          if (patientDisplay) {
                            // For after-shift report entries, link to the specific report
                            if (patientDisplay.isReport && entry.details?.handoff_id) {
                              return (
                                <Link
                                  href={`/${facilitySlug}/dashboard/after-shift-reports?report=${entry.details.handoff_id}`}
                                  className="flex items-center gap-1 text-sm font-medium text-[#2D7A7A] hover:text-[#2D7A7A]/80 hover:underline transition-colors"
                                >
                                  {patientDisplay.name}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              );
                            }
                            // For issue-related entries, clicking opens the issue detail panel
                            if (entry.issue?.id) {
                              return (
                                <button
                                  onClick={() => handlePatientClick(entry.issue!.id)}
                                  className="flex items-center gap-1 text-sm font-medium text-[#2D7A7A] hover:text-[#2D7A7A]/80 hover:underline transition-colors cursor-pointer text-left"
                                >
                                  {patientDisplay.name}
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              );
                            }
                            // For patient_created entries, link to patient page
                            if (entry.action === 'patient_created' && patientDisplay.id) {
                              return (
                                <Link
                                  href={`/${facilitySlug}/dashboard/patients?patient=${patientDisplay.id}`}
                                  className="flex items-center gap-1 text-sm font-medium text-[#2D7A7A] hover:text-[#2D7A7A]/80 hover:underline transition-colors"
                                >
                                  {patientDisplay.name}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              );
                            }
                            // Just display the name if no link is available
                            return (
                              <span className="text-sm font-medium">{patientDisplay.name}</span>
                            );
                          }
                          return <span className="text-sm text-muted-foreground">N/A</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell>
                      {(() => {
                        const actionLink = getActionLink(entry);
                        const badgeContent = (
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-xs',
                              actionColors[entry.action] || 'bg-gray-500/10 text-gray-700',
                              actionLink && 'cursor-pointer hover:opacity-80'
                            )}
                          >
                            {actionLabels[entry.action] || entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        );

                        // If there's a direct link for this action
                        if (actionLink) {
                          return (
                            <Link href={actionLink} className="inline-flex items-center gap-1">
                              {badgeContent}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </Link>
                          );
                        }

                        // For issue-related actions, make the badge clickable to open issue detail
                        if (entry.issue?.id && ['created', 'assigned', 'status_changed', 'resolved', 'lifecycle_completed', 'updated', 'message_sent'].includes(entry.action)) {
                          return (
                            <button
                              onClick={() => handlePatientClick(entry.issue!.id)}
                              className="inline-flex items-center gap-1"
                            >
                              {badgeContent}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </button>
                          );
                        }

                        return badgeContent;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.user?.name ||
                        entry.user?.email?.split('@')[0] ||
                        'Unknown User'}
                    </TableCell>
                    <TableCell className="text-body text-muted-foreground max-w-md truncate">
                      {formatDetails(entry.action, entry.details, entry.assigned_to_user)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Issue Detail Panel */}
      <IssueDetailPanel
        issue={selectedIssue}
        open={isDetailPanelOpen}
        onOpenChange={(open) => {
          setIsDetailPanelOpen(open);
          if (!open) setSelectedIssue(null);
        }}
        onResolve={handleResolveIssue}
        onAssign={handleAssignIssue}
        onStatusChange={handleStatusChange}
        currentUserId={currentUserId}
        userRole={userRole}
        availableUsers={availableUsers}
      />
    </div>
  );
}
