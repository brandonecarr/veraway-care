'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, ChevronUp } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { TypingIndicator } from './typing-indicator';
import type { MessageWithSender, User, ConversationWithDetails } from '@/types/messages';
import { cn } from '@/lib/utils';

interface MessageThreadProps {
  conversation: ConversationWithDetails | null;
  messages: MessageWithSender[];
  currentUserId: string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  typingUsers: User[];
  onMarkRead: () => void;
}

export function MessageThread({
  conversation,
  messages,
  currentUserId,
  isLoading,
  hasMore,
  onLoadMore,
  onSendMessage,
  onTyping,
  typingUsers,
  onMarkRead,
}: MessageThreadProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoadRef.current) {
        messagesEndRef.current?.scrollIntoView();
        isInitialLoadRef.current = false;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [conversation?.id]);

  // Mark as read when viewing
  useEffect(() => {
    if (conversation) {
      onMarkRead();
    }
  }, [conversation, onMarkRead]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#FAFAF8]">
        <MessageSquare className="w-16 h-16 text-[#D4D4D4] mb-4" />
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">
          Select a conversation
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choose a conversation from the list to start messaging your team
        </p>
      </div>
    );
  }

  const getConversationTitle = () => {
    if (conversation.type === 'patient' && conversation.patient) {
      return `${conversation.patient.first_name} ${conversation.patient.last_name} - Care Team`;
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#D4D4D4] shrink-0">
        <h2 className="font-semibold text-[#1A1A1A]">{getConversationTitle()}</h2>
        <p className="text-xs text-muted-foreground">
          {conversation.participants?.length || 0} participants
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading}
                className="text-[#2D7A7A]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ChevronUp className="w-4 h-4 mr-2" />
                )}
                Load earlier messages
              </Button>
            </div>
          )}

          {/* Messages */}
          {messages.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto text-[#D4D4D4] mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start the conversation below
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.sender_id === currentUserId}
              />
            ))
          )}

          {/* Loading indicator */}
          {isLoading && messages.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#2D7A7A]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Typing Indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Message Input */}
      <MessageInput onSend={onSendMessage} onTyping={onTyping} />
    </div>
  );
}
