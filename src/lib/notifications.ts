import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendPushNotificationToMultipleUsers, type PushNotificationPayload } from './push-notifications';

// Create admin client for notification operations (bypasses RLS)
const getAdminClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

export type NotificationType =
  | 'new_patient'
  | 'patient_update'
  | 'new_issue'
  | 'issue_update'
  | 'issue_resolved'
  | 'issue_assigned'
  | 'message'
  | 'handoff'
  | 'status_change'
  | 'overdue';

export interface FacilityNotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  senderId: string;
  facilityId: string;
  metadata?: Record<string, unknown>;
  relatedIssueId?: string;
  relatedPatientId?: string;
  url?: string;
}

/**
 * Get all user IDs for a facility except the sender
 */
async function getFacilityUserIds(
  facilityId: string,
  excludeUserId: string
): Promise<string[]> {
  const adminClient = getAdminClient();

  const { data: users, error } = await adminClient
    .from('users')
    .select('id')
    .eq('facility_id', facilityId)
    .neq('id', excludeUserId);

  if (error) {
    console.error('Error fetching facility users:', error);
    return [];
  }

  return users?.map((u) => u.id) || [];
}

/**
 * Send notifications to all facility users (except sender)
 * Creates in-app notifications and sends push notifications
 */
export async function sendFacilityNotification(
  payload: FacilityNotificationPayload
): Promise<{ success: boolean; recipientCount: number }> {
  try {
    const adminClient = getAdminClient();

    // Get all facility users except the sender
    const recipientIds = await getFacilityUserIds(
      payload.facilityId,
      payload.senderId
    );

    if (recipientIds.length === 0) {
      return { success: true, recipientCount: 0 };
    }

    // Create in-app notifications for all recipients
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      related_issue_id: payload.relatedIssueId || null,
      metadata: {
        ...payload.metadata,
        sender_id: payload.senderId,
        patient_id: payload.relatedPatientId,
        push_queued: true,
      },
    }));

    // Insert all notifications
    const { error: insertError } = await adminClient
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Failed to create notifications:', insertError);
    }

    // Send push notifications (fire and forget)
    const pushPayload: PushNotificationPayload = {
      title: payload.title,
      body: payload.message,
      url: payload.url || '/dashboard',
      tag: `${payload.type}-${Date.now()}`,
      issueId: payload.relatedIssueId,
    };

    sendPushNotificationToMultipleUsers(recipientIds, pushPayload).catch(
      (error) => {
        console.error('Failed to send push notifications:', error);
      }
    );

    return { success: true, recipientCount: recipientIds.length };
  } catch (error) {
    console.error('Error sending facility notification:', error);
    return { success: false, recipientCount: 0 };
  }
}

/**
 * Get the facility ID for a user
 */
export async function getUserFacilityId(userId: string): Promise<string | null> {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('users')
    .select('facility_id')
    .eq('id', userId)
    .single();

  if (error || !data?.facility_id) {
    console.error('Error getting user facility:', error);
    return null;
  }

  return data.facility_id;
}

/**
 * Get user name for display in notifications
 */
export async function getUserName(userId: string): Promise<string> {
  const adminClient = getAdminClient();

  const { data } = await adminClient
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  return data?.name || data?.email?.split('@')[0] || 'Someone';
}

/**
 * Helper to build notification for new patient
 */
export async function notifyNewPatient(
  senderId: string,
  facilityId: string,
  patient: { id: string; first_name: string; last_name: string; mrn: string }
): Promise<void> {
  const senderName = await getUserName(senderId);

  await sendFacilityNotification({
    type: 'new_patient',
    title: 'New Patient Added',
    message: `${senderName} added ${patient.first_name} ${patient.last_name} (MRN: ${patient.mrn})`,
    senderId,
    facilityId,
    relatedPatientId: patient.id,
    url: '/dashboard',
    metadata: {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_mrn: patient.mrn,
      sender_name: senderName,
    },
  });
}

/**
 * Helper to build notification for patient update
 */
export async function notifyPatientUpdate(
  senderId: string,
  facilityId: string,
  patient: { id: string; first_name: string; last_name: string; mrn: string },
  changes?: string
): Promise<void> {
  const senderName = await getUserName(senderId);

  await sendFacilityNotification({
    type: 'patient_update',
    title: 'Patient Updated',
    message: `${senderName} updated ${patient.first_name} ${patient.last_name}${changes ? `: ${changes}` : ''}`,
    senderId,
    facilityId,
    relatedPatientId: patient.id,
    url: '/dashboard',
    metadata: {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_mrn: patient.mrn,
      sender_name: senderName,
      changes,
    },
  });
}

/**
 * Helper to build notification for new issue
 */
export async function notifyNewIssue(
  senderId: string,
  facilityId: string,
  issue: {
    id: string;
    issue_number: number;
    issue_type: string;
    description?: string;
  },
  patient: { first_name: string; last_name: string }
): Promise<void> {
  const senderName = await getUserName(senderId);

  await sendFacilityNotification({
    type: 'new_issue',
    title: `New Issue: ${issue.issue_type}`,
    message: `${senderName} reported an issue for ${patient.first_name} ${patient.last_name}`,
    senderId,
    facilityId,
    relatedIssueId: issue.id,
    url: `/dashboard?issue=${issue.id}`,
    metadata: {
      issue_number: issue.issue_number,
      issue_type: issue.issue_type,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      sender_name: senderName,
      description: issue.description,
    },
  });
}

/**
 * Helper to build notification for issue update/note
 */
export async function notifyIssueUpdate(
  senderId: string,
  facilityId: string,
  issue: { id: string; issue_number: number },
  patient: { first_name: string; last_name: string },
  note: string
): Promise<void> {
  const senderName = await getUserName(senderId);

  await sendFacilityNotification({
    type: 'issue_update',
    title: 'Issue Update Added',
    message: `${senderName} added a note to Issue #${issue.issue_number} (${patient.first_name} ${patient.last_name})`,
    senderId,
    facilityId,
    relatedIssueId: issue.id,
    url: `/dashboard?issue=${issue.id}`,
    metadata: {
      issue_number: issue.issue_number,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      sender_name: senderName,
      note: note.substring(0, 100),
    },
  });
}

/**
 * Helper to build notification for issue status change
 */
export async function notifyIssueStatusChange(
  senderId: string,
  facilityId: string,
  issue: { id: string; issue_number: number },
  patient: { first_name: string; last_name: string },
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const senderName = await getUserName(senderId);
  const isResolved = newStatus === 'resolved';

  await sendFacilityNotification({
    type: isResolved ? 'issue_resolved' : 'status_change',
    title: isResolved ? 'Issue Resolved' : 'Issue Status Changed',
    message: isResolved
      ? `${senderName} resolved Issue #${issue.issue_number} (${patient.first_name} ${patient.last_name})`
      : `${senderName} changed Issue #${issue.issue_number} to ${newStatus.replace('_', ' ')}`,
    senderId,
    facilityId,
    relatedIssueId: issue.id,
    url: `/dashboard?issue=${issue.id}`,
    metadata: {
      issue_number: issue.issue_number,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      sender_name: senderName,
      old_status: oldStatus,
      new_status: newStatus,
    },
  });
}

/**
 * Helper to build notification for issue assignment
 */
export async function notifyIssueAssigned(
  senderId: string,
  facilityId: string,
  issue: { id: string; issue_number: number },
  patient: { first_name: string; last_name: string },
  assigneeId: string
): Promise<void> {
  const senderName = await getUserName(senderId);
  const assigneeName = await getUserName(assigneeId);

  await sendFacilityNotification({
    type: 'issue_assigned',
    title: 'Issue Assigned',
    message: `${senderName} assigned Issue #${issue.issue_number} to ${assigneeName}`,
    senderId,
    facilityId,
    relatedIssueId: issue.id,
    url: `/dashboard?issue=${issue.id}`,
    metadata: {
      issue_number: issue.issue_number,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      sender_name: senderName,
      assignee_id: assigneeId,
      assignee_name: assigneeName,
    },
  });
}
