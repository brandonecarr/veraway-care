'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Download, FileText, CheckCircle2, Clock, Shield, Mail } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ISSUE_TYPE_COLORS } from '@/types/care-coordination';

interface ReportGeneratorProps {
  issues: any[];
  metrics: any;
  includeAuditTrail?: boolean;
}

export function ReportGenerator({ issues, metrics, includeAuditTrail = true }: ReportGeneratorProps) {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [reportType, setReportType] = useState<string>('summary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeResolutionProof, setIncludeResolutionProof] = useState(true);
  const [includeTimelines, setIncludeTimelines] = useState(true);
  const [includeAuditLog, setIncludeAuditLog] = useState(true);
  const [auditLogData, setAuditLogData] = useState<any[]>([]);
  
  // Filter states
  const [filterIssueType, setFilterIssueType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClinician, setFilterClinician] = useState<string>('all');
  
  // Get unique values for filters
  const issueTypes = Array.from(new Set(issues.map(i => i.issue_type)));
  const clinicians = Array.from(new Set(issues.filter(i => i.assignee).map(i => i.assignee.id)));
  const clinicianMap = issues.reduce((acc, i) => {
    if (i.assignee) acc[i.assignee.id] = i.assignee.name || i.assignee.email?.split('@')[0];
    return acc;
  }, {} as Record<string, string>);
  
  // Fetch audit log data when includeAuditLog is enabled
  useEffect(() => {
    if (includeAuditLog) {
      fetchAuditLog();
    }
  }, [includeAuditLog]);
  
  const fetchAuditLog = async () => {
    try {
      const response = await fetch('/api/audit-log');
      if (response.ok) {
        const data = await response.json();
        setAuditLogData(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Filter issues by date range AND filters
      const filteredIssues = issues.filter((issue) => {
        const issueDate = new Date(issue.created_at);
        const dateMatch = (!dateRange.from || issueDate >= dateRange.from) &&
                         (!dateRange.to || issueDate <= dateRange.to);
        const typeMatch = filterIssueType === 'all' || issue.issue_type === filterIssueType;
        const statusMatch = filterStatus === 'all' || issue.status === filterStatus;
        const clinicianMatch = filterClinician === 'all' || issue.assigned_to === filterClinician;
        
        return dateMatch && typeMatch && statusMatch && clinicianMatch;
      });

      // Header
      doc.setFontSize(24);
      doc.setTextColor(26, 26, 26);
      doc.text('Care Coordination Report', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      const dateRangeText = `${format(dateRange.from || new Date(), 'MMM d, yyyy')} - ${format(
        dateRange.to || new Date(),
        'MMM d, yyyy'
      )}`;
      doc.text(dateRangeText, pageWidth / 2, 28, { align: 'center' });
      
      // Display active filters
      let yPos = 32;
      const activeFilters = [];
      if (filterIssueType !== 'all') activeFilters.push(`Type: ${filterIssueType.replace(/_/g, ' ')}`);
      if (filterStatus !== 'all') activeFilters.push(`Status: ${filterStatus}`);
      if (filterClinician !== 'all') activeFilters.push(`Clinician: ${clinicianMap[filterClinician]}`);
      
      if (activeFilters.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(153, 153, 153);
        doc.text(`Filters: ${activeFilters.join(' • ')}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      }

      // Summary Section
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text('Executive Summary', 14, yPos + 13);

      const summaryData = [
        ['Total Issues', filteredIssues.length.toString()],
        ['Open Issues', filteredIssues.filter((i) => i.status === 'open').length.toString()],
        ['Resolved Issues', filteredIssues.filter((i) => i.status === 'resolved').length.toString()],
        ['Overdue Issues', filteredIssues.filter((i) => i.status === 'overdue').length.toString()],
        [
          'Resolution Rate',
          `${Math.round(
            (filteredIssues.filter((i) => i.status === 'resolved').length / filteredIssues.length) * 100
          )}%`,
        ],
      ];

      autoTable(doc, {
        startY: yPos + 18,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 5,
        },
        headStyles: {
          fillColor: [250, 250, 248],
          textColor: [26, 26, 26],
          fontStyle: 'bold',
        },
      });

      // Issues by Type
      const issuesByType = filteredIssues.reduce((acc: any, issue) => {
        acc[issue.issue_type] = (acc[issue.issue_type] || 0) + 1;
        return acc;
      }, {});

      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text('Issues by Type', 14, (doc as any).lastAutoTable.finalY + 15);

      const typeData = Object.entries(issuesByType).map(([type, count]) => [
        type.replace(/_/g, ' ').toUpperCase(),
        count.toString(),
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Issue Type', 'Count']],
        body: typeData,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 5,
        },
        headStyles: {
          fillColor: [250, 250, 248],
          textColor: [26, 26, 26],
          fontStyle: 'bold',
        },
      });

      // Detailed Issue List
      if (reportType === 'detailed') {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(26, 26, 26);
        doc.text('Detailed Issue List', 14, 20);

        const detailedData = filteredIssues.map((issue) => [
          `#${issue.issue_number}`,
          `${issue.patient?.first_name || ''} ${issue.patient?.last_name || ''}`.trim() || 'N/A',
          issue.issue_type.replace(/_/g, ' '),
          issue.status.toUpperCase(),
          format(new Date(issue.created_at), 'MMM d, yyyy'),
          issue.resolved_at ? format(new Date(issue.resolved_at), 'MMM d, yyyy') : '-',
        ]);

        autoTable(doc, {
          startY: 25,
          head: [['Issue #', 'Patient', 'Type', 'Status', 'Created', 'Resolved']],
          body: detailedData,
          theme: 'striped',
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
          headStyles: {
            fillColor: [45, 122, 122],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [250, 250, 248],
          },
        });
      }

      // Resolution Proof Section
      if (includeResolutionProof) {
        const resolvedIssues = filteredIssues.filter((i) => i.status === 'resolved' && i.resolved_at);
        if (resolvedIssues.length > 0) {
          doc.addPage();
          doc.setFontSize(16);
          doc.setTextColor(26, 26, 26);
          doc.text('Resolution Proof', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(102, 102, 102);
          doc.text('Documented evidence of issue resolution within the reporting period', 14, 28);

          const resolutionData = resolvedIssues.map((issue) => {
            const createdDate = new Date(issue.created_at);
            const resolvedDate = new Date(issue.resolved_at);
            const resolutionTimeHours = Math.round((resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
            return [
              `#${issue.issue_number}`,
              `${issue.patient?.first_name || ''} ${issue.patient?.last_name || ''}`.trim() || 'N/A',
              issue.issue_type.replace(/_/g, ' '),
              format(createdDate, 'MMM d, HH:mm'),
              format(resolvedDate, 'MMM d, HH:mm'),
              `${resolutionTimeHours}h`,
            ];
          });

          autoTable(doc, {
            startY: 35,
            head: [['Issue #', 'Patient', 'Type', 'Created', 'Resolved', 'Time to Resolve']],
            body: resolutionData,
            theme: 'striped',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [129, 178, 154], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 248] },
          });

          // Resolution summary
          const avgResolutionTime = resolvedIssues.reduce((sum, issue) => {
            const created = new Date(issue.created_at).getTime();
            const resolved = new Date(issue.resolved_at).getTime();
            return sum + (resolved - created);
          }, 0) / resolvedIssues.length / (1000 * 60 * 60);

          doc.setFontSize(10);
          doc.setTextColor(26, 26, 26);
          const yPos = (doc as any).lastAutoTable.finalY + 15;
          doc.text(`Total Resolved Issues: ${resolvedIssues.length}`, 14, yPos);
          doc.text(`Average Resolution Time: ${avgResolutionTime.toFixed(1)} hours`, 14, yPos + 7);
        }
      }

      // Issue Timelines
      if (includeTimelines && reportType === 'detailed') {
        const openIssues = filteredIssues.filter((i) => i.status !== 'resolved').slice(0, 10);
        if (openIssues.length > 0) {
          doc.addPage();
          doc.setFontSize(16);
          doc.setTextColor(26, 26, 26);
          doc.text('Open Issues Timeline', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(102, 102, 102);
          doc.text('Issues requiring follow-up action (showing up to 10)', 14, 28);

          const timelineData = openIssues.map((issue) => {
            const createdDate = new Date(issue.created_at);
            const hoursOpen = Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60));
            const isOverdue = hoursOpen > 24;
            return [
              `#${issue.issue_number}`,
              `${issue.patient?.first_name || ''} ${issue.patient?.last_name || ''}`.trim() || 'N/A',
              issue.issue_type.replace(/_/g, ' '),
              issue.status.toUpperCase(),
              format(createdDate, 'MMM d, HH:mm'),
              `${hoursOpen}h ${isOverdue ? '⚠️' : ''}`,
              issue.assignee?.name || issue.assignee?.email?.split('@')[0] || 'Unassigned',
            ];
          });

          autoTable(doc, {
            startY: 35,
            head: [['Issue #', 'Patient', 'Type', 'Status', 'Created', 'Age', 'Assigned To']],
            body: timelineData,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [224, 122, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 248] },
          });
        }
      }

      // Audit Log Section
      if (includeAuditLog && auditLogData.length > 0) {
        const issueIds = filteredIssues.map(i => i.id);
        const relevantAuditEntries = auditLogData.filter(entry => 
          issueIds.includes(entry.issue_id) &&
          (!dateRange.from || new Date(entry.created_at) >= dateRange.from) &&
          (!dateRange.to || new Date(entry.created_at) <= dateRange.to)
        ).slice(0, 50); // Limit to 50 entries
        
        if (relevantAuditEntries.length > 0) {
          doc.addPage();
          doc.setFontSize(16);
          doc.setTextColor(26, 26, 26);
          doc.text('Audit Trail', 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(102, 102, 102);
          doc.text('Complete audit log of actions taken within the reporting period (max 50 entries)', 14, 28);
          
          const auditData = relevantAuditEntries.map(entry => {
            const issueNumber = filteredIssues.find(i => i.id === entry.issue_id)?.issue_number || 'N/A';
            return [
              format(new Date(entry.created_at), 'MMM d HH:mm'),
              `#${issueNumber}`,
              entry.action_type.replace(/_/g, ' ').toUpperCase(),
              entry.user?.email?.split('@')[0] || 'System',
              entry.details?.substring(0, 40) || '-',
            ];
          });
          
          autoTable(doc, {
            startY: 35,
            head: [['Timestamp', 'Issue #', 'Action', 'User', 'Details']],
            body: auditData,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [45, 122, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 248] },
            columnStyles: {
              0: { cellWidth: 28 },
              1: { cellWidth: 20 },
              2: { cellWidth: 35 },
              3: { cellWidth: 30 },
              4: { cellWidth: 65 },
            },
          });
        }
      }

      // Footer
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(153, 153, 153);
        doc.text(
          `Generated on ${format(new Date(), 'MMM d, yyyy HH:mm')} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Save
      const filename = `care-coordination-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const setPresetRange = (preset: string) => {
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
    }
  };

  return (
    <Card className="p-6 bg-brand-off-white border-brand-border shadow-card">
      <div className="space-y-6">
        <div>
          <h3 className="text-section-title font-display flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-brand-teal" />
            Generate Report
          </h3>
          <p className="text-body text-muted-foreground">
            Export comprehensive PDF reports with issue timelines, resolution metrics, and audit trails
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal border-[#D4D4D4]',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPresetRange('today')}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange('week')}>
                This Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPresetRange('month')}>
                This Month
              </Button>
            </div>
          </div>

          {/* Report Type */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="border-[#D4D4D4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary Report</SelectItem>
                <SelectItem value="detailed">Detailed Report (with issue list)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Filters Section */}
        <div className="p-4 bg-white rounded-lg border border-[#D4D4D4] space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-teal" />
              <h4 className="text-sm font-semibold">Report Filters</h4>
              <Badge variant="secondary" className="text-xs">Optional</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {issues.filter((issue) => {
                const issueDate = new Date(issue.created_at);
                const dateMatch = (!dateRange.from || issueDate >= dateRange.from) &&
                                 (!dateRange.to || issueDate <= dateRange.to);
                const typeMatch = filterIssueType === 'all' || issue.issue_type === filterIssueType;
                const statusMatch = filterStatus === 'all' || issue.status === filterStatus;
                const clinicianMatch = filterClinician === 'all' || issue.assigned_to === filterClinician;
                return dateMatch && typeMatch && statusMatch && clinicianMatch;
              }).length} issues match current filters
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Issue Type</Label>
              <Select value={filterIssueType} onValueChange={setFilterIssueType}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {issueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Assigned Clinician</Label>
              <Select value={filterClinician} onValueChange={setFilterClinician}>
                <SelectTrigger className="h-9 text-sm border-[#D4D4D4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clinicians</SelectItem>
                  {clinicians.map(id => (
                    <SelectItem key={id} value={id}>
                      {clinicianMap[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Report Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-[#D4D4D4]">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="resolutionProof"
              checked={includeResolutionProof}
              onCheckedChange={(checked) => setIncludeResolutionProof(checked as boolean)}
            />
            <label htmlFor="resolutionProof" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#81B29A]" />
              Include Resolution Proof
            </label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="timelines"
              checked={includeTimelines}
              onCheckedChange={(checked) => setIncludeTimelines(checked as boolean)}
            />
            <label htmlFor="timelines" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E07A5F]" />
              Include Open Timelines
            </label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="auditLog"
              checked={includeAuditLog}
              onCheckedChange={(checked) => setIncludeAuditLog(checked as boolean)}
            />
            <label htmlFor="auditLog" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2D7A7A]" />
              Include Audit Trail
            </label>
          </div>
        </div>

        <Button
          onClick={generatePDF}
          disabled={isGenerating || !dateRange.from || !dateRange.to}
          className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
          size="lg"
        >
          <Download className="w-4 h-4 mr-2" />
          {isGenerating ? 'Generating Report...' : 'Generate PDF Report'}
        </Button>
      </div>
    </Card>
  );
}
