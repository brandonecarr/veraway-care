'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Users, User as UserIcon, Heart } from 'lucide-react';
import type { ConversationWithDetails } from '@/types/messages';

interface ConversationListItemProps {
  conversation: ConversationWithDetails;
  isSelected: boolean;
  currentUserId: string;
  onClick: () => void;
}

export function ConversationListItem({
  conversation,
  isSelected,
  currentUserId,
  onClick,
}: ConversationListItemProps) {
  const getDisplayName = () => {
    if (conversation.type === 'patient' && conversation.patient) {
      return `${conversation.patient.first_name} ${conversation.patient.last_name}`;
    }
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants?.find(
        (p) => p.user_id !== currentUserId
      );
      return (
        otherParticipant?.user?.name ||
        otherParticipant?.user?.email?.split('@')[0] ||
        'Direct Message'
      );
    }
    return conversation.name || 'Group Chat';
  };

  const getSubtitle = () => {
    if (conversation.type === 'patient') {
      return 'Care Team';
    }
    if (conversation.type === 'group') {
      return `${conversation.participants?.length || 0} members`;
    }
    return null;
  };

  const getAvatar = () => {
    if (conversation.type === 'patient') {
      return (
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-[#E07A5F]/10 text-[#E07A5F]">
            <Heart className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
      );
    }
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants?.find(
        (p) => p.user_id !== currentUserId
      );
      return (
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-[#2D7A7A]/10 text-[#2D7A7A]">
            {otherParticipant?.user?.name?.[0]?.toUpperCase() ||
              otherParticipant?.user?.email?.[0]?.toUpperCase() ||
              <UserIcon className="w-5 h-5" />}
          </AvatarFallback>
        </Avatar>
      );
    }
    return (
      <Avatar className="w-10 h-10">
        <AvatarFallback className="bg-[#81B29A]/10 text-[#81B29A]">
          <Users className="w-5 h-5" />
        </AvatarFallback>
      </Avatar>
    );
  };

  const getTypeBadge = () => {
    if (conversation.type === 'patient') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]">
          Patient
        </Badge>
      );
    }
    if (conversation.type === 'group') {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]">
          Group
        </Badge>
      );
    }
    return null;
  };

  const unreadCount = conversation.unread_count || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 flex items-start gap-3 text-left transition-colors hover:bg-[#FAFAF8]',
        isSelected && 'bg-[#2D7A7A]/5 border-l-2 border-l-[#2D7A7A]'
      )}
    >
      {getAvatar()}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'font-medium text-sm truncate',
                unreadCount > 0 ? 'text-[#1A1A1A]' : 'text-[#666]'
              )}
            >
              {getDisplayName()}
            </span>
            {getTypeBadge()}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(conversation.last_message_at), {
              addSuffix: false,
            })}
          </span>
        </div>

        {getSubtitle() && (
          <p className="text-xs text-muted-foreground">{getSubtitle()}</p>
        )}

        {conversation.last_message_preview && (
          <p
            className={cn(
              'text-xs mt-1 truncate',
              unreadCount > 0
                ? 'text-[#1A1A1A] font-medium'
                : 'text-muted-foreground'
            )}
          >
            {conversation.last_message_preview}
          </p>
        )}
      </div>

      {unreadCount > 0 && (
        <Badge className="bg-[#2D7A7A] text-white text-xs min-w-[20px] h-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </button>
  );
}
