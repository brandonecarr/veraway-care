'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

interface ExportOptions {
  issues: IDGIssue[];
  summary: IDGSummary;
  weekStart: string;
  weekEnd: string;
  groupBy: 'patient' | 'issue_type';
}

export async function generateIDGPDF({
  issues,
  summary,
  weekStart,
  weekEnd,
  groupBy
}: ExportOptions): Promise<void> {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFontSize(24);
    doc.setTextColor(26, 26, 26);
    doc.text('IDG Issue Review', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(102, 102, 102);
    const weekRange = `Week of ${format(new Date(weekStart), 'MMM d')} - ${format(new Date(weekEnd), 'MMM d, yyyy')}`;
    doc.text(weekRange, pageWidth / 2, 28, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth / 2, 35, { align: 'center' });

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text('Summary', 14, 48);

    const summaryData = [
      ['Total Issues for IDG Review', summary.totalIssues.toString()],
      ['Urgent Priority', summary.byPriority.urgent.toString()],
      ['High Priority', summary.byPriority.high.toString()],
      ['Overdue (>' + summary.thresholdHours + 'h)', summary.overdue.toString()],
      ['Open Status', summary.byStatus.open.toString()],
      ['In Progress', summary.byStatus.in_progress.toString()],
    ];

    autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Count']],
      body: summaryData,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [250, 250, 248],
        textColor: [26, 26, 26],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40, halign: 'center' },
      },
    });

    // Issues by Type Summary
    const issueTypeData = Object.entries(summary.byIssueType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => [type, count.toString()]);

    if (issueTypeData.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text('Issues by Type', 14, (doc as any).lastAutoTable.finalY + 15);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 19,
        head: [['Issue Type', 'Count']],
        body: issueTypeData,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [250, 250, 248],
          textColor: [26, 26, 26],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 40, halign: 'center' },
        },
      });
    }

    // Detailed Issue List
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 26);
    doc.text('Detailed Issue List', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    doc.text('All issues meeting IDG review criteria', 14, 27);

    // Prepare detailed data
    const detailedData = issues.map((issue) => {
      const actionsText = formatActionsForPDF(issue.actions_taken || []);
      const nextStepsText = formatNextStepsForPDF(issue.outstanding_next_steps || []);

      return [
        `${issue.patient_name}\n(MRN: ${issue.patient_mrn})`,
        issue.issue_type,
        format(new Date(issue.created_at), 'MMM d, h:mm a'),
        issue.assignee_job_role || issue.assignee_name,
        issue.status.replace('_', ' ').toUpperCase(),
        actionsText,
        nextStepsText,
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [['Patient', 'Issue Type', 'Date', 'Discipline', 'Status', 'Actions Taken', 'Next Steps']],
      body: detailedData,
      theme: 'striped',
      styles: {
        fontSize: 7,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: [45, 122, 122],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 248],
      },
      columnStyles: {
        0: { cellWidth: 28 }, // Patient
        1: { cellWidth: 25 }, // Issue Type
        2: { cellWidth: 22 }, // Date
        3: { cellWidth: 22 }, // Discipline
        4: { cellWidth: 18 }, // Status
        5: { cellWidth: 38 }, // Actions Taken
        6: { cellWidth: 35 }, // Next Steps
      },
      didDrawPage: (data) => {
        // Add page numbers
        const pageNumber = doc.internal.pages.length - 1;
        doc.setFontSize(8);
        doc.setTextColor(153, 153, 153);
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      },
    });

    // Priority-based breakdown (if any urgent or high priority)
    const urgentIssues = issues.filter(i => i.priority === 'urgent');
    const highIssues = issues.filter(i => i.priority === 'high');

    if (urgentIssues.length > 0 || highIssues.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text('Priority Issues', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text('Urgent and high priority issues requiring immediate attention', 14, 27);

      let yPos = 35;

      if (urgentIssues.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.text(`URGENT PRIORITY (${urgentIssues.length})`, 14, yPos);

        const urgentData = urgentIssues.map(issue => [
          `#${issue.issue_number}`,
          issue.patient_name,
          issue.issue_type,
          `${Math.round(issue.hours_open)}h open`,
          issue.assignee_name,
        ]);

        autoTable(doc, {
          startY: yPos + 5,
          head: [['Issue #', 'Patient', 'Type', 'Age', 'Assigned To']],
          body: urgentData,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [254, 226, 226],
            textColor: [185, 28, 28],
            fontStyle: 'bold',
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      if (highIssues.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(234, 88, 12);
        doc.text(`HIGH PRIORITY (${highIssues.length})`, 14, yPos);

        const highData = highIssues.map(issue => [
          `#${issue.issue_number}`,
          issue.patient_name,
          issue.issue_type,
          `${Math.round(issue.hours_open)}h open`,
          issue.assignee_name,
        ]);

        autoTable(doc, {
          startY: yPos + 5,
          head: [['Issue #', 'Patient', 'Type', 'Age', 'Assigned To']],
          body: highData,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [255, 237, 213],
            textColor: [194, 65, 12],
            fontStyle: 'bold',
          },
        });
      }
    }

    // Overdue issues section
    const overdueIssues = issues.filter(i => i.is_overdue);
    if (overdueIssues.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 26);
      doc.text('Overdue Issues', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text(`Issues unresolved beyond ${summary.thresholdHours} hours`, 14, 27);

      const overdueData = overdueIssues.map(issue => [
        `#${issue.issue_number}`,
        issue.patient_name,
        issue.issue_type,
        format(new Date(issue.created_at), 'MMM d, h:mm a'),
        formatHoursOpen(issue.hours_open),
        issue.assignee_name,
        issue.status.replace('_', ' ').toUpperCase(),
      ]);

      autoTable(doc, {
        startY: 32,
        head: [['Issue #', 'Patient', 'Type', 'Created', 'Hours Open', 'Assigned To', 'Status']],
        body: overdueData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [239, 68, 68],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242],
        },
      });
    }

    // Footer on all pages
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(
        `CareTrack IDG Review | ${weekRange} | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save
    const filename = `idg-review-${format(new Date(weekStart), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
    toast.success('IDG Review PDF exported successfully');
  } catch (error) {
    console.error('Error generating IDG PDF:', error);
    toast.error('Failed to generate PDF');
    throw error;
  }
}

function formatHoursOpen(hours: number): string {
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days}d ${remainingHours}h`;
}

function formatActionsForPDF(actions: any[]): string {
  if (!actions || actions.length === 0) return 'None documented';
  return actions
    .slice(0, 2)
    .map(a => {
      const actionLabel = (a.action || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
      return `${actionLabel}`;
    })
    .join('\n');
}

function formatNextStepsForPDF(steps: any[]): string {
  if (!steps || steps.length === 0) return 'None pending';
  const latestStep = steps[0];
  const message = latestStep.message || '';
  return message.length > 60 ? message.substring(0, 60) + '...' : message;
}
