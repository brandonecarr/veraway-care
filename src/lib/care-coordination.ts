import { createClient } from '../../supabase/server';
import type { Issue, Patient, IssueMessage, AuditLogEntry, DashboardMetrics } from '@/types/care-coordination';

export async function getIssues(filters?: {
  status?: string;
  assigned_to?: string;
  patient_id?: string;
  includeResolved?: boolean;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  // Use Supabase joins to fetch all related data in a single query
  // This replaces the previous N+1 pattern (2 queries -> 1 query)
  let query = supabase
    .from('issues')
    .select(`
      *,
      patient:patients(*),
      assignee:assigned_to(id, email, name, avatar_url),
      reporter:reported_by(id, email, name, avatar_url),
      resolver:resolved_by(id, email, name, avatar_url)
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

  // Add pagination
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as any[];
}

export async function getIssueById(id: string) {
  const supabase = await createClient();

  // Use Supabase joins to fetch all related data in a single query
  const { data, error } = await supabase
    .from('issues')
    .select(`
      *,
      patient:patients(*),
      assignee:assigned_to(id, email, name, avatar_url),
      reporter:reported_by(id, email, name, avatar_url),
      resolver:resolved_by(id, email, name, avatar_url)
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
  assigned_to?: string;
}) {
  const supabase = await createClient();

  // Auto-assign to creator if no assignee specified
  const issueData = {
    ...issue,
    assigned_to: issue.assigned_to || issue.reported_by,
  };

  const { data, error } = await supabase
    .from('issues')
    .insert(issueData)
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

export async function getPatients(filters?: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .order('last_name', { ascending: true });

  // Filter by status if provided
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  // Add pagination
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as Patient[], count };
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

  // Use Supabase joins to fetch user data in a single query
  const { data, error } = await supabase
    .from('issue_messages')
    .select(`
      *,
      user:user_id(id, email, name, avatar_url)
    `)
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

  // Use Supabase joins to fetch all related data in a single query
  let query = supabase
    .from('issue_audit_log')
    .select(`
      *,
      user:user_id(id, email, name),
      issue:issue_id(id, issue_number)
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

  // Get the current user's ID
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Use database function for optimal performance
  // Pass user ID so the function can filter by facility and use last_activity_at for overdue calc
  const { data, error } = await supabase.rpc('get_dashboard_metrics', {
    p_user_id: user.id
  });

  if (error) throw error;

  // Return the data directly as it's already in the correct format
  return data as DashboardMetrics;
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
