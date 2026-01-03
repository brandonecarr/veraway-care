'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Heart,
  Calendar,
  FileText,
  ExternalLink,
  Users,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { ConversationWithDetails } from '@/types/messages';
import type { Issue } from '@/types/care-coordination';
import { ISSUE_TYPE_COLORS } from '@/types/care-coordination';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface PatientInfoPaneProps {
  conversation: ConversationWithDetails | null;
  currentUserId: string;
  onClose?: () => void;
  onIssueClick?: (issue: Issue) => void;
}

export function PatientInfoPane({
  conversation,
  currentUserId,
  onClose,
  onIssueClick,
}: PatientInfoPaneProps) {
  const params = useParams();
  const facilitySlug = params?.slug as string;
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);

  // Fetch issues for the patient when conversation changes
  useEffect(() => {
    const fetchPatientIssues = async () => {
      if (conversation?.type !== 'patient' || !conversation?.patient_id) {
        setIssues([]);
        return;
      }

      setIsLoadingIssues(true);
      try {
        const response = await fetch(`/api/issues?patient_id=${conversation.patient_id}`);
        if (response.ok) {
          const data = await response.json();
          // Sort by created_at descending (most recent first)
          const sortedIssues = (data.issues || data || []).sort(
            (a: Issue, b: Issue) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setIssues(sortedIssues);
        }
      } catch (error) {
        console.error('Failed to fetch patient issues:', error);
      } finally {
        setIsLoadingIssues(false);
      }
    };

    fetchPatientIssues();
  }, [conversation?.patient_id, conversation?.type]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="w-3 h-3 text-[#81B29A]" />;
      case 'in_progress':
        return <Clock className="w-3 h-3 text-[#F4A261]" />;
      default:
        return <AlertCircle className="w-3 h-3 text-[#E07A5F]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]';
      case 'in_progress':
        return 'bg-[#F4A261]/10 text-[#F4A261] border-[#F4A261]';
      default:
        return 'bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]';
    }
  };

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-[#FAFAF8] p-8">
        <p className="text-sm text-muted-foreground text-center">
          Select a conversation to view details
        </p>
      </div>
    );
  }

  const isPatientChat = conversation.type === 'patient' && conversation.patient;
  const patient = conversation.patient;

  return (
    <div className="h-full flex flex-col bg-[#FAFAF8] border-l border-[#D4D4D4]">
      {/* Header */}
      <div className="p-4 border-b border-[#D4D4D4] flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-[#1A1A1A]">
          {isPatientChat ? 'Patient Info' : 'Conversation Info'}
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Patient Info Card */}
          {isPatientChat && patient && (
            <Card className="p-4 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-[#E07A5F]/10 text-[#E07A5F]">
                    <Heart className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A]">
                    {patient.first_name} {patient.last_name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    MRN: {patient.mrn}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {patient.date_of_birth && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">DOB:</span>
                    <span>{format(new Date(patient.date_of_birth), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {patient.admission_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Admitted:</span>
                    <span>{format(new Date(patient.admission_date), 'MMM d, yyyy')}</span>
                  </div>
                )}

                {patient.diagnosis && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">Diagnosis:</span>
                    <span className="flex-1">{patient.diagnosis}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant="outline"
                    className={
                      patient.status === 'active'
                        ? 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]'
                        : 'bg-[#D4D4D4]/20 text-muted-foreground'
                    }
                  >
                    {patient.status}
                  </Badge>
                </div>
              </div>

              {facilitySlug && (
                <Link href={`/${facilitySlug}/dashboard/patients/${patient.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4 border-[#2D7A7A] text-[#2D7A7A] hover:bg-[#2D7A7A]/5"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Patient Profile
                  </Button>
                </Link>
              )}
            </Card>
          )}

          {/* Patient Issues */}
          {isPatientChat && (
            <div>
              <h4 className="font-medium text-sm text-[#1A1A1A] mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Issues ({issues.length})
              </h4>

              {isLoadingIssues ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground bg-white rounded-lg">
                  No issues for this patient
                </div>
              ) : (
                <div className="space-y-2">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-3 rounded-lg bg-white border border-transparent hover:border-[#2D7A7A] cursor-pointer transition-all hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(issue.status)}
                          <span className="text-xs font-medium text-muted-foreground">
                            #{issue.issue_number}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${getStatusColor(issue.status)}`}
                        >
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                          style={{
                            backgroundColor: `${ISSUE_TYPE_COLORS[issue.issue_type] || '#6C757D'}20`,
                            color: ISSUE_TYPE_COLORS[issue.issue_type] || '#6C757D',
                          }}
                        >
                          {issue.issue_type}
                        </Badge>
                      </div>

                      {issue.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {issue.description}
                        </p>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          <div>
            <h4 className="font-medium text-sm text-[#1A1A1A] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({conversation.participants?.length || 0})
            </h4>

            <div className="space-y-2">
              {conversation.participants?.map((participant) => {
                const isCurrentUser = participant.user_id === currentUserId;
                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-[#2D7A7A]/10 text-[#2D7A7A] text-xs">
                        {participant.user?.name?.[0]?.toUpperCase() ||
                          participant.user?.email?.[0]?.toUpperCase() ||
                          'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">
                        {participant.user?.name ||
                          participant.user?.email?.split('@')[0] ||
                          'Unknown'}
                        {isCurrentUser && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            (you)
                          </span>
                        )}
                      </p>
                      {participant.user?.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {participant.user.email}
                        </p>
                      )}
                    </div>
                    {participant.role === 'admin' && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Admin
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversation Info */}
          <div>
            <Separator className="mb-4" />
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Created:{' '}
                {format(new Date(conversation.created_at), 'MMM d, yyyy')}
              </p>
              <p>Type: {conversation.type}</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
