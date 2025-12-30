'use client';

import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { MessageWithSender } from '@/types/messages';

interface MessageBubbleProps {
  message: MessageWithSender;
  isCurrentUser: boolean;
}

/**
 * MessageBubble - Memoized to prevent re-renders when other messages change
 * Only re-renders when this message's content or edit status changes
 */
export const MessageBubble = memo(function MessageBubble({ message, isCurrentUser }: MessageBubbleProps) {
  // System messages
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 animate-in fade-in duration-200',
        isCurrentUser && 'flex-row-reverse'
      )}
    >
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isCurrentUser
              ? 'bg-[#2D7A7A] text-white'
              : 'bg-[#2D7A7A]/10 text-[#2D7A7A]'
          )}
        >
          {message.sender?.name?.[0]?.toUpperCase() ||
            message.sender?.email?.[0]?.toUpperCase() ||
            'U'}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'flex-1 space-y-1 min-w-0 max-w-[70%]',
          isCurrentUser && 'text-right'
        )}
      >
        <div
          className={cn(
            'flex items-baseline gap-2 flex-wrap',
            isCurrentUser && 'justify-end'
          )}
        >
          <span className="text-sm font-medium text-[#1A1A1A]">
            {isCurrentUser
              ? 'You'
              : message.sender?.name ||
                message.sender?.email?.split('@')[0] ||
                'Unknown'}
          </span>
          <span className="text-xs text-[#999] font-mono">
            {format(new Date(message.created_at), 'MMM d, h:mm a')}
          </span>
          {message.is_edited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
        <div
          className={cn(
            'rounded-lg p-3 text-sm',
            isCurrentUser
              ? 'bg-[#2D7A7A] text-white'
              : 'bg-[#FAFAF8] text-[#666] border border-[#D4D4D4]'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
});
