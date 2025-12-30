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

  // Add pagination
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Manually fetch user data for each issue using auth.users
  if (data) {
    const userIds = new Set<string>();
    data.forEach((issue: any) => {
      if (issue.assigned_to) userIds.add(issue.assigned_to);
      if (issue.reported_by) userIds.add(issue.reported_by);
      if (issue.resolved_by) userIds.add(issue.resolved_by);
    });

    // Fetch users from public.users table
    const { data: users } = await supabase
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', Array.from(userIds));

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Attach user data to issues
    return data.map((issue: any) => ({
      ...issue,
      assignee: issue.assigned_to ? userMap.get(issue.assigned_to) : null,
      reporter: issue.reported_by ? userMap.get(issue.reported_by) : null,
      resolver: issue.resolved_by ? userMap.get(issue.resolved_by) : null,
    }));
  }

  return data as any[];
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

  // Manually fetch user data
  if (data) {
    const userIds = [data.assigned_to, data.reported_by, data.resolved_by].filter(Boolean);

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return {
        ...data,
        assignee: data.assigned_to ? userMap.get(data.assigned_to) : null,
        reporter: data.reported_by ? userMap.get(data.reported_by) : null,
        resolver: data.resolved_by ? userMap.get(data.resolved_by) : null,
      };
    }
  }

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

  const { data, error } = await supabase
    .from('issue_messages')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Manually fetch user data
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map(m => m.user_id).filter(Boolean)));

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      return data.map(message => ({
        ...message,
        user: message.user_id ? userMap.get(message.user_id) : null,
      }));
    }
  }

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
    .select('*')
    .order('created_at', { ascending: false });

  if (issueId) {
    query = query.eq('issue_id', issueId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Manually fetch user data and issue numbers
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map(a => a.user_id).filter(Boolean)));
    const issueIds = Array.from(new Set(data.map(a => a.issue_id).filter(Boolean)));

    const promises = [];

    if (userIds.length > 0) {
      promises.push(
        supabase
          .from('users')
          .select('id, email, name')
          .in('id', userIds)
      );
    }

    if (issueIds.length > 0) {
      promises.push(
        supabase
          .from('issues')
          .select('id, issue_number')
          .in('id', issueIds)
      );
    }

    const results = await Promise.all(promises);
    const userMap = new Map(results[0]?.data?.map((u: any) => [u.id, u]) || []);
    const issueMap = new Map(results[1]?.data?.map((i: any) => [i.id, i]) || []);

    return data.map(log => ({
      ...log,
      user: log.user_id ? userMap.get(log.user_id) : null,
      issue: log.issue_id ? issueMap.get(log.issue_id) : null,
    }));
  }

  return data as any[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();

  // Use database function for optimal performance
  const { data, error } = await supabase.rpc('get_dashboard_metrics');

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
