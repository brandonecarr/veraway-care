'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, ChevronUp } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { TypingIndicator } from './typing-indicator';
import type { MessageWithSender, User, ConversationWithDetails } from '@/types/messages';

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
  const parentRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  // Virtual scrolling for performance with large message lists
  const virtualizer = useVirtualizer({
    count: messages.length + (hasMore ? 1 : 0), // +1 for load more button
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []), // Approximate message height
    overscan: 10, // Render extra items for smooth scrolling
    getItemKey: useCallback((index: number) => {
      if (hasMore && index === 0) return 'load-more';
      const msgIndex = hasMore ? index - 1 : index;
      return messages[msgIndex]?.id || index;
    }, [messages, hasMore]),
  });

  // Scroll to bottom on initial load and new messages (not when loading more)
  useEffect(() => {
    if (messages.length > 0 && parentRef.current) {
      const isNewMessage = messages.length > prevMessagesLengthRef.current && !isLoadingMoreRef.current;

      if (isInitialLoadRef.current) {
        // Initial load - scroll to bottom immediately
        virtualizer.scrollToIndex(messages.length - 1 + (hasMore ? 1 : 0), { align: 'end' });
        isInitialLoadRef.current = false;
      } else if (isNewMessage) {
        // New message received - scroll to bottom smoothly
        virtualizer.scrollToIndex(messages.length - 1 + (hasMore ? 1 : 0), { align: 'end', behavior: 'smooth' });
      }

      prevMessagesLengthRef.current = messages.length;
      isLoadingMoreRef.current = false;
    }
  }, [messages.length, virtualizer, hasMore]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    prevMessagesLengthRef.current = 0;
  }, [conversation?.id]);

  // Mark as read when viewing
  useEffect(() => {
    if (conversation) {
      onMarkRead();
    }
  }, [conversation, onMarkRead]);

  // Handle load more with tracking
  const handleLoadMore = useCallback(async () => {
    isLoadingMoreRef.current = true;
    await onLoadMore();
  }, [onLoadMore]);

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

      {/* Messages - Virtualized for performance */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 mx-auto text-[#D4D4D4] mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the conversation below
            </p>
          </div>
        </div>
      ) : isLoading && messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#2D7A7A]" />
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              // First item is load more button when hasMore is true
              if (hasMore && virtualRow.index === 0) {
                return (
                  <div
                    key="load-more"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex justify-center py-2 px-4"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
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
                );
              }

              const messageIndex = hasMore ? virtualRow.index - 1 : virtualRow.index;
              const message = messages[messageIndex];

              if (!message) return null;

              return (
                <div
                  key={message.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-4 py-2"
                >
                  <MessageBubble
                    message={message}
                    isCurrentUser={message.sender_id === currentUserId}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Message Input */}
      <MessageInput onSend={onSendMessage} onTyping={onTyping} />
    </div>
  );
}
