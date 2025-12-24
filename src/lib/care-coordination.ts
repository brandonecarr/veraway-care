import { createClient } from '../../supabase/server';
import type { Issue, Patient, IssueMessage, AuditLogEntry, DashboardMetrics } from '@/types/care-coordination';

export async function getIssues(filters?: {
  status?: string;
  assigned_to?: string;
  patient_id?: string;
  includeResolved?: boolean;
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from('issues')
    .select(`
      *,
      patient:patients(*)
    `)
    .order('created_at', { ascending: false });

  // By default, exclude resolved issues unless explicitly requested
  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else if (!filters?.includeResolved) {
    query = query.neq('status', 'resolved');
  }
  
  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }
  
  if (filters?.patient_id) {
    query = query.eq('patient_id', filters.patient_id);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  // Fetch assignee data from public.users table
  const assigneeIds = Array.from(new Set(data?.filter(d => d.assigned_to).map(d => d.assigned_to) || []));
  
  let assigneesMap: Record<string, any> = {};
  if (assigneeIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', assigneeIds);
    
    if (usersData) {
      assigneesMap = usersData.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }
  }
  
  // Merge assignee data into issues
  const enrichedData = data?.map(issue => ({
    ...issue,
    assignee: issue.assigned_to ? assigneesMap[issue.assigned_to] : null
  }));
  
  return enrichedData as any[];
}

export async function getIssueById(id: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      patient:patients(*)
    `)
    .eq('id', id)
    .single();
    
  if (error) throw error;
  return data;
}

export async function createIssue(issue: {
  patient_id: string;
  reported_by: string;
  issue_type: string;
  description?: string;
  priority?: string;
  tags?: string[];
}) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('issues')
    .insert(issue)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateIssue(id: string, updates: Partial<Issue>) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function getPatients() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('last_name', { ascending: true });
    
  if (error) throw error;
  return data as Patient[];
}

export async function getPatient(id: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw error;
  return data as Patient;
}

export async function createPatient(patient: {
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  admission_date?: string;
  diagnosis?: string;
  status?: string;
}) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('patients')
    .insert([{
      ...patient,
      status: patient.status || 'active'
    }])
    .select()
    .single();
    
  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(id: string, updates: Partial<Patient>) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data as Patient;
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
  return true;
}

export async function searchPatients(searchTerm: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,mrn.ilike.%${searchTerm}%`)
    .limit(10);
    
  if (error) throw error;
  return data as Patient[];
}

export async function getIssueMessages(issueId: string) {
  const supabase = await createClient();
  
  // Fetch messages - user data will be fetched separately by the API route
  const { data, error } = await supabase
    .from('issue_messages')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
}

export async function addIssueMessage(issueId: string, userId: string, message: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('issue_messages')
    .insert({ issue_id: issueId, user_id: userId, message })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function getAuditLog(issueId?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('issue_audit_log')
    .select(`
      *,
      user:user_id(id, email, raw_user_meta_data),
      issue:issues(issue_number)
    `)
    .order('created_at', { ascending: false });

  if (issueId) {
    query = query.eq('issue_id', issueId);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data as any[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();
  
  const { data: allIssues, error } = await supabase
    .from('issues')
    .select('*');
    
  if (error) throw error;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const openIssues = allIssues?.filter(i => i.status === 'open' || i.status === 'in_progress') || [];
  const overdueIssues = allIssues?.filter(i => {
    if (i.status === 'resolved') return false;
    const createdAt = new Date(i.created_at);
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  }) || [];
  
  const resolvedToday = allIssues?.filter(i => {
    if (i.status !== 'resolved' || !i.resolved_at) return false;
    const resolvedAt = new Date(i.resolved_at);
    return resolvedAt >= today;
  }) || [];
  
  const resolvedIssues = allIssues?.filter(i => i.status === 'resolved' && i.resolved_at) || [];
  const avgResolutionTime = resolvedIssues.length > 0
    ? resolvedIssues.reduce((acc, issue) => {
        const created = new Date(issue.created_at).getTime();
        const resolved = new Date(issue.resolved_at!).getTime();
        return acc + (resolved - created) / (1000 * 60 * 60);
      }, 0) / resolvedIssues.length
    : 0;
    
  // Only count active (non-resolved) issues for the "Issues by Type" filter
  const typeCount: Record<string, number> = {};
  (allIssues || []).filter(issue => issue.status !== 'resolved').forEach(issue => {
    typeCount[issue.issue_type] = (typeCount[issue.issue_type] || 0) + 1;
  });
  const issuesByType: { type: string; count: number }[] = Object.entries(typeCount).map(([type, count]) => ({ type, count }));
  
  // Calculate clinician responsiveness
  const assigneeStats: Record<string, { 
    resolved: number; 
    open: number; 
    totalResolutionTime: number;
    resolvedCount: number;
  }> = {};
  
  (allIssues || []).forEach(issue => {
    if (issue.assigned_to) {
      if (!assigneeStats[issue.assigned_to]) {
        assigneeStats[issue.assigned_to] = { resolved: 0, open: 0, totalResolutionTime: 0, resolvedCount: 0 };
      }
      if (issue.status === 'resolved' && issue.resolved_at) {
        assigneeStats[issue.assigned_to].resolved++;
        const created = new Date(issue.created_at).getTime();
        const resolved = new Date(issue.resolved_at).getTime();
        assigneeStats[issue.assigned_to].totalResolutionTime += (resolved - created) / (1000 * 60 * 60);
        assigneeStats[issue.assigned_to].resolvedCount++;
      } else {
        assigneeStats[issue.assigned_to].open++;
      }
    }
  });
  
  // Fetch user details for assignees
  const assigneeIds = Object.keys(assigneeStats);
  let clinicianResponsiveness: DashboardMetrics['clinicianResponsiveness'] = [];
  
  if (assigneeIds.length > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', assigneeIds);
    
    if (usersData) {
      clinicianResponsiveness = usersData.map(user => {
        const stats = assigneeStats[user.id];
        return {
          userId: user.id,
          name: user.name || user.email?.split('@')[0] || 'Unknown',
          email: user.email || '',
          avgResponseTime: stats.resolvedCount > 0 
            ? stats.totalResolutionTime / stats.resolvedCount 
            : 0,
          issuesResolved: stats.resolved,
          openIssues: stats.open
        };
      }).sort((a, b) => b.issuesResolved - a.issuesResolved);
    }
  }
  
  return {
    totalIssues: allIssues?.length || 0,
    openIssues: openIssues.length,
    overdueIssues: overdueIssues.length,
    resolvedToday: resolvedToday.length,
    avgResolutionTime,
    issuesByType,
    clinicianResponsiveness
  };
}

export async function getUserRole(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error;
  return data?.role || 'clinician';
}

export async function getAllUsers() {
  const supabase = await createClient();
  
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) throw error;
  return data.users;
}
