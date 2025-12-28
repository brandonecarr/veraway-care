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
  created_at: string;
  updated_at: string;
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
  is_active?: boolean;
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
  'Death',
  'Infection',
  'Incident',
  'Unmanaged Pain',
  'Med Discrepancies',
  'DME Malfunction',
  'Missed/Declined Visit',
  'Not Following Plan-of-Care'
] as const;

export const ISSUE_TYPE_COLORS: Record<string, string> = {
  'Change in Condition': '#2D7A7A',
  'Concern/Complaint': '#E07A5F',
  'Death': '#1A1A1A',
  'Infection': '#E07A5F',
  'Incident': '#F4A261',
  'Unmanaged Pain': '#E07A5F',
  'Med Discrepancies': '#264653',
  'DME Malfunction': '#81B29A',
  'Missed/Declined Visit': '#457B9D',
  'Not Following Plan-of-Care': '#6C757D'
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
