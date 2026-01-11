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
  idg_reasons: string[];
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
  dateRange?: { start: string; end: string };
  weekRange?: { start: string; end: string }; // Legacy support
  thresholdHours: number;
}

interface PatientOverviewItem {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  date_of_birth?: string;
  diagnosis?: string;
  level_of_care?: string;
  residence_type?: string;
  benefit_period?: number;
  admission_date?: string;
  discharge_date?: string;
  death_date?: string;
  rn_case_manager?: { name?: string; job_role?: string };
  days_remaining?: number | null;
  bp_end_date?: string | null;
  discharge_reason?: string | null;
  bereavement_status?: string | null;
}

// Expiring benefit period can be either the old format or the new PatientOverviewItem format
interface ExpiringBenefitPeriodItem {
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;
  // Also support PatientOverviewItem fields
  id?: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  date_of_birth?: string;
  diagnosis?: string;
  level_of_care?: string;
  residence_type?: string;
  benefit_period?: number;
  admission_date?: string;
  rn_case_manager?: { name?: string; job_role?: string };
  days_remaining?: number | null;
  end_date?: string;
  bp_end_date?: string | null;
}

interface ExportOptions {
  issues: IDGIssue[];
  summary: IDGSummary;
  weekStart: string;
  weekEnd: string;
  groupBy: 'patient' | 'issue_type';
  // New fields for enhanced PDF
  hospiceName?: string;
  meetingDateTime?: string;
  censusPatients?: PatientOverviewItem[];
  admissions?: PatientOverviewItem[];
  discharges?: PatientOverviewItem[];
  expiringBenefitPeriods?: ExpiringBenefitPeriodItem[];
  totalCensusCount?: number;
}

export async function generateIDGPDF({
  issues,
  summary,
  weekStart,
  weekEnd,
  groupBy,
  hospiceName,
  meetingDateTime,
  censusPatients = [],
  admissions = [],
  discharges = [],
  expiringBenefitPeriods = [],
  totalCensusCount = 0
}: ExportOptions): Promise<void> {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header - New format: Hospice Name, IDG Issues Outline, Meeting Date/Time
    let headerY = 15;

    // Hospice Name (if provided)
    if (hospiceName) {
      doc.setFontSize(16);
      doc.setTextColor(102, 102, 102);
      doc.text(hospiceName, pageWidth / 2, headerY, { align: 'center' });
      headerY += 10;
    }

    // IDG Issues Outline title
    doc.setFontSize(24);
    doc.setTextColor(26, 26, 26);
    doc.text('IDG Issues Outline', pageWidth / 2, headerY, { align: 'center' });
    headerY += 10;

    // Meeting Date/Time (if provided) or fall back to date range
    doc.setFontSize(12);
    doc.setTextColor(102, 102, 102);
    if (meetingDateTime) {
      const meetingDate = new Date(meetingDateTime);
      doc.text(format(meetingDate, 'MMMM d, yyyy h:mm a'), pageWidth / 2, headerY, { align: 'center' });
    } else {
      const weekRange = `Week of ${format(new Date(weekStart), 'MMM d')} - ${format(new Date(weekEnd), 'MMM d, yyyy')}`;
      doc.text(weekRange, pageWidth / 2, headerY, { align: 'center' });
    }
    headerY += 7;

    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth / 2, headerY, { align: 'center' });

    // Summary Section
    let sectionY = headerY + 15;
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text('Summary', 14, sectionY);

    const summaryData = [
      ['Total Issues for IDG Review', summary.totalIssues.toString()],
      ['Urgent Priority', summary.byPriority.urgent.toString()],
      ['High Priority', summary.byPriority.high.toString()],
      ['Overdue (>' + summary.thresholdHours + 'h)', summary.overdue.toString()],
      ['Open Status', summary.byStatus.open.toString()],
      ['In Progress', summary.byStatus.in_progress.toString()],
    ];

    autoTable(doc, {
      startY: sectionY + 4,
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

    // Census Patient Count
    if (totalCensusCount > 0 || censusPatients.length > 0) {
      const currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setTextColor(26, 26, 26);
      const censusCount = totalCensusCount || censusPatients.length;
      doc.text(`Total Current Census: ${censusCount} patients`, 14, currentY);
    }

    // =====================================================
    // PATIENT OVERVIEW SECTIONS
    // =====================================================
    doc.addPage();
    doc.setFontSize(18);
    doc.setTextColor(26, 26, 26);
    doc.text('Patient Overview', 14, 20);
    let overviewY = 30;

    // Helper function to format date
    const formatDate = (dateStr: string | undefined | null) => {
      if (!dateStr) return '-';
      try {
        return format(new Date(dateStr), 'MM/dd/yyyy');
      } catch {
        return '-';
      }
    };

    // Helper function to format BP with days remaining
    const formatBP = (bp: number | undefined, daysRemaining: number | null | undefined) => {
      if (!bp) return '-';
      if (daysRemaining !== null && daysRemaining !== undefined) {
        return `BP${bp} (${daysRemaining}d)`;
      }
      return `BP${bp}`;
    };

    // 1. ADMISSIONS SECTION
    // Columns: Patient name, Date of birth, Diagnosis, Level of Care, Home/Facility, Benefits Period, BP Dates, RNCM Assigned
    if (admissions.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(45, 122, 122); // Teal color
      doc.text(`Admissions (${admissions.length})`, 14, overviewY);

      const admissionsData = admissions.map(p => {
        // Format BP dates as "Start - End"
        const bpDates = p.admission_date && p.bp_end_date
          ? `${formatDate(p.admission_date)} - ${formatDate(p.bp_end_date)}`
          : formatDate(p.admission_date);

        return [
          `${p.first_name} ${p.last_name}`,
          formatDate(p.date_of_birth),
          p.diagnosis || '-',
          p.level_of_care || '-',
          p.residence_type || '-',
          p.benefit_period ? `BP${p.benefit_period}` : '-',
          bpDates,
          p.rn_case_manager?.name || '-',
        ];
      });

      autoTable(doc, {
        startY: overviewY + 4,
        head: [['Patient Name', 'DOB', 'Diagnosis', 'Level of Care', 'Home/Facility', 'Benefit Period', 'BP Dates', 'RNCM Assigned']],
        body: admissionsData,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: [45, 122, 122],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [240, 250, 250] },
      });
      overviewY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 2. DISCHARGES SECTION
    // Columns: Patient name, Diagnosis, Discharge date, Reason for discharge, Bereavement status (if applicable)
    if (discharges.length > 0) {
      // Check if we need a new page
      if (overviewY > pageHeight - 60) {
        doc.addPage();
        overviewY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(234, 88, 12); // Orange color
      doc.text(`Discharges (${discharges.length})`, 14, overviewY);

      const dischargesData = discharges.map(p => [
        `${p.first_name} ${p.last_name}`,
        p.diagnosis || '-',
        formatDate(p.discharge_date),
        p.discharge_reason || '-',
        p.bereavement_status || '-',
      ]);

      autoTable(doc, {
        startY: overviewY + 4,
        head: [['Patient Name', 'Diagnosis', 'Discharge Date', 'Reason for Discharge', 'Bereavement Status']],
        body: dischargesData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [234, 88, 12],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [255, 245, 235] },
      });
      overviewY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 3. UPCOMING RECERTIFICATIONS SECTION (≤14 days in BP)
    // Columns: Patient name, DOB, diagnosis, Level of Care, Home/Facility, BP, Days until BP expiration (show date of expiration as well), Clinician assigned
    if (expiringBenefitPeriods.length > 0) {
      // Check if we need a new page
      if (overviewY > pageHeight - 60) {
        doc.addPage();
        overviewY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(147, 51, 234); // Purple color
      doc.text(`Upcoming Recertifications (${expiringBenefitPeriods.length})`, 14, overviewY);
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      doc.text('Patients with ≤14 days remaining in benefit period', 14, overviewY + 5);

      const recertData = expiringBenefitPeriods.map(p => {
        // Support both old format (patient_name) and new format (first_name + last_name)
        const patientName = p.patient_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '-';
        // Format expiration as "X days (MM/DD/YYYY)"
        const expirationDate = p.bp_end_date || p.end_date;
        const daysUntilExpiration = expirationDate
          ? `${p.days_remaining ?? 0} days (${formatDate(expirationDate)})`
          : `${p.days_remaining ?? 0} days`;

        return [
          patientName,
          formatDate(p.date_of_birth),
          p.diagnosis || '-',
          p.level_of_care || '-',
          p.residence_type || '-',
          p.benefit_period ? `BP${p.benefit_period}` : '-',
          daysUntilExpiration,
          p.rn_case_manager?.name || '-',
        ];
      });

      autoTable(doc, {
        startY: overviewY + 9,
        head: [['Patient Name', 'DOB', 'Diagnosis', 'Level of Care', 'Home/Facility', 'BP', 'Days Until Expiration', 'Clinician Assigned']],
        body: recertData,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: [147, 51, 234],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [250, 240, 255] },
      });
      overviewY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 4. ISSUES SELECTED SECTION
    // Columns: Patient name, Current Issue Card (issue type, description, status, assignee combined)
    if (issues.length > 0) {
      // Check if we need a new page
      if (overviewY > pageHeight - 60) {
        doc.addPage();
        overviewY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text(`Issues Selected for IDG (${issues.length})`, 14, overviewY);

      const issuesSelectedData = issues.map(issue => {
        // Format current issue card as a multi-line summary
        const statusText = issue.status.replace('_', ' ').toUpperCase();
        const assignee = issue.assignee_job_role || issue.assignee_name;
        const descSnippet = issue.description
          ? (issue.description.length > 80 ? issue.description.substring(0, 80) + '...' : issue.description)
          : '';

        const issueCard = [
          `[${issue.issue_type}] ${statusText}`,
          descSnippet,
          `Assigned: ${assignee}`
        ].filter(Boolean).join('\n');

        return [
          issue.patient_name,
          issueCard,
        ];
      });

      autoTable(doc, {
        startY: overviewY + 4,
        head: [['Patient Name', 'Current Issue']],
        body: issuesSelectedData,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
        headStyles: {
          fillColor: [45, 122, 122],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 140 },
        },
        alternateRowStyles: { fillColor: [250, 250, 248] },
      });
      overviewY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 5. TOTAL CURRENT CENSUS SECTION
    // Columns: Patient name, DOB, diagnosis, Level of Care, Home/Facility, BP, Days until BP expiration (show date of expiration as well), Clinician assigned
    if (censusPatients.length > 0) {
      // Check if we need a new page
      if (overviewY > pageHeight - 60) {
        doc.addPage();
        overviewY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(26, 26, 26);
      doc.text(`Total Current Census (${censusPatients.length} patients)`, 14, overviewY);

      const censusData = censusPatients.map(p => {
        // Format expiration as "X days (MM/DD/YYYY)"
        const daysUntilExpiration = p.bp_end_date
          ? `${p.days_remaining ?? '-'} days (${formatDate(p.bp_end_date)})`
          : (p.days_remaining !== null && p.days_remaining !== undefined ? `${p.days_remaining} days` : '-');

        return [
          `${p.first_name} ${p.last_name}`,
          formatDate(p.date_of_birth),
          p.diagnosis || '-',
          p.level_of_care || '-',
          p.residence_type || '-',
          p.benefit_period ? `BP${p.benefit_period}` : '-',
          daysUntilExpiration,
          p.rn_case_manager?.name || '-',
        ];
      });

      autoTable(doc, {
        startY: overviewY + 4,
        head: [['Patient Name', 'DOB', 'Diagnosis', 'Level of Care', 'Home/Facility', 'BP', 'Days Until Expiration', 'Clinician Assigned']],
        body: censusData,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: [239, 246, 255] },
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
    const dateRangeStr = meetingDateTime
      ? format(new Date(meetingDateTime), 'MMM d, yyyy')
      : `${format(new Date(weekStart), 'MMM d')} - ${format(new Date(weekEnd), 'MMM d, yyyy')}`;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(153, 153, 153);
      doc.text(
        `CareTrack IDG Outline | ${dateRangeStr} | Page ${i} of ${pageCount}`,
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
