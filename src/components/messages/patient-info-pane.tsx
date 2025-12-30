'use client';

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
  User,
  ExternalLink,
  Users,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ConversationWithDetails } from '@/types/messages';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface PatientInfoPaneProps {
  conversation: ConversationWithDetails | null;
  currentUserId: string;
  onClose?: () => void;
}

export function PatientInfoPane({
  conversation,
  currentUserId,
  onClose,
}: PatientInfoPaneProps) {
  const params = useParams();
  const facilitySlug = params?.slug as string;

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
