export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'overdue';
export type IssuePriority = 'low' | 'normal' | 'high' | 'urgent';
export type UserRole = 'clinician' | 'coordinator' | 'after_hours';
export type NotificationType = 'assignment' | 'message' | 'status_change' | 'handoff' | 'overdue' | 'mention';

export interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  admission_date?: string;
  diagnosis?: string;
  status: string;
  admitted_date?: string;
  discharge_date?: string;
  death_date?: string;
  cause_of_death?: string;
  bereavement_status?: string;
  benefit_period?: number;
  level_of_care?: string;
  rn_case_manager_id?: string;
  rn_case_manager?: { id: string; name?: string; email?: string; job_role?: string };
  residence_type?: string;
  created_at: string;
  updated_at: string;
}

// Bereavement status options
export const BEREAVEMENT_STATUSES = [
  'Education Provided',
  'Education Not Yet Provided',
] as const;

// Level of Care options
export const LEVELS_OF_CARE = [
  'Routine Care',
  'General Inpatient Care',
  'Continuous Care',
  'Respite Care',
] as const;

// Residence type options
export const RESIDENCE_TYPES = ['Home', 'Facility'] as const;

// Benefit period options
export const BENEFIT_PERIODS = [1, 2, 3, 4, 5, 6] as const;

// Get the length of a benefit period in days
export function getBenefitPeriodDays(period: number): number {
  return period <= 2 ? 90 : 60;
}

// Calculate days remaining in benefit period
export function getBenefitPeriodDaysRemaining(admittedDate: string | undefined, period: number): number | null {
  if (!admittedDate) return null;

  const admitted = new Date(admittedDate);
  const periodDays = getBenefitPeriodDays(period);
  const endDate = new Date(admitted.getTime() + periodDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, daysRemaining);
}

export interface Issue {
  id: string;
  issue_number: number;
  patient_id: string;
  reported_by: string;
  assigned_to?: string;
  issue_type: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  tags?: string[];
  resolved_at?: string;
  resolved_by?: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  reporter?: { id: string; email?: string; name?: string };
  assignee?: { id: string; email?: string; name?: string };
}

export interface IssueMessage {
  id: string;
  issue_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: { id: string; email?: string; name?: string };
}

export interface AuditLogEntry {
  id: string;
  issue_id: string;
  user_id: string;
  action: string;
  details: any;
  created_at: string;
  user?: { id: string; email?: string; name?: string };
}

export interface Handoff {
  id: string;
  created_by: string;
  shift_start?: string;
  shift_end?: string;
  notes?: string;
  tagged_issues?: string[];
  created_at: string;
  is_archived?: boolean;
  creator?: { id: string; email?: string; name?: string };
}

// Alias for new naming convention
export type AfterShiftReport = Handoff;

export interface DashboardMetrics {
  totalIssues: number;
  openIssues: number;
  overdueIssues: number;
  resolvedToday: number;
  avgResolutionTime: number;
  issuesByType: { type: string; count: number }[];
  clinicianResponsiveness?: {
    userId: string;
    name: string;
    email: string;
    avgResponseTime: number;
    issuesResolved: number;
    openIssues: number;
  }[];
}

export const ISSUE_TYPES = [
  'Change in Condition',
  'Concern/Complaint',
  'Infection',
  'Incident',
  'Unmanaged Pain',
  'Med Discrepancies',
  'DME Malfunction',
  'Missed/Declined Visit',
  'Not Following Plan-of-Care',
  'Discharged',
  'Death'
] as const;

// Issue types that require a date/time timestamp
export const TIMESTAMPED_ISSUE_TYPES = ['Discharged', 'Death'] as const;

export const ISSUE_TYPE_COLORS: Record<string, string> = {
  'Change in Condition': '#2D7A7A',
  'Concern/Complaint': '#E07A5F',
  'Infection': '#E07A5F',
  'Incident': '#F4A261',
  'Unmanaged Pain': '#E07A5F',
  'Med Discrepancies': '#264653',
  'DME Malfunction': '#81B29A',
  'Missed/Declined Visit': '#457B9D',
  'Not Following Plan-of-Care': '#6C757D',
  'Discharged': '#8B5CF6',
  'Death': '#1A1A1A'
};

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_issue_id?: string;
  related_patient_id?: string;
  related_handoff_id?: string;
  metadata?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  issue?: Issue;
  patient?: Patient;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  notify_on_assignment: boolean;
  notify_on_mention: boolean;
  notify_on_issue_update: boolean;
  notify_on_handoff: boolean;
  notify_on_overdue: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  created_at: string;
  updated_at: string;
}
