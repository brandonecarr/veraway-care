'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Info, Menu } from 'lucide-react';
import { ConversationList } from './conversation-list';
import { MessageThread } from './message-thread';
import { PatientInfoPane } from './patient-info-pane';
import { NewConversationDialog } from './new-conversation-dialog';
import { useRealtimeConversations } from '@/hooks/use-realtime-conversations';
import { useRealtimeChatMessages } from '@/hooks/use-realtime-chat-messages';
import type { ConversationWithDetails } from '@/types/messages';
import { cn } from '@/lib/utils';

interface MessageCenterProps {
  userId: string;
  initialConversationId?: string | null;
}

export function MessageCenter({ userId, initialConversationId }: MessageCenterProps) {
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationWithDetails | null>(null);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

  const { conversations, isLoading: isLoadingConversations, refreshConversations } =
    useRealtimeConversations({ selectedConversationId: selectedConversation?.id });

  const {
    messages,
    isLoading: isLoadingMessages,
    hasMore,
    loadMore,
    sendMessage,
    typingUsers,
    setTyping,
  } = useRealtimeChatMessages(selectedConversation?.id || null);

  // Load initial conversation from query param when conversations are loaded
  useEffect(() => {
    if (initialConversationId && conversations.length > 0 && !hasLoadedInitial) {
      const conversation = conversations.find(c => c.id === initialConversationId);
      if (conversation) {
        setSelectedConversation(conversation);
        setHasLoadedInitial(true);
      }
    }
  }, [initialConversationId, conversations, hasLoadedInitial]);

  const handleSelectConversation = useCallback(
    async (conversation: ConversationWithDetails) => {
      setSelectedConversation(conversation);
      setIsMobileListOpen(false);

      // Mark conversation as read when selected
      if (conversation.unread_count && conversation.unread_count > 0) {
        try {
          await fetch(`/api/conversations/${conversation.id}/read`, {
            method: 'POST',
          });
          // Refresh to update unread counts in the list
          refreshConversations();
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }
      }
    },
    [refreshConversations]
  );

  const handleConversationCreated = useCallback(
    (conversation: ConversationWithDetails) => {
      setSelectedConversation(conversation);
      refreshConversations();
    },
    [refreshConversations]
  );

  const handleMarkRead = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      await fetch(`/api/conversations/${selectedConversation.id}/read`, {
        method: 'POST',
      });
      // Refresh to update unread counts in the list
      refreshConversations();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [selectedConversation, refreshConversations]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#D4D4D4] bg-white">
        <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.id || null}
              currentUserId={userId}
              isLoading={isLoadingConversations}
              onSelect={handleSelectConversation}
              onNewConversation={() => setIsNewConversationOpen(true)}
            />
          </SheetContent>
        </Sheet>

        <h1 className="font-semibold text-[#1A1A1A]">Messages</h1>

        {selectedConversation && (
          <Sheet open={isMobileInfoOpen} onOpenChange={setIsMobileInfoOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0">
              <PatientInfoPane
                conversation={selectedConversation}
                currentUserId={userId}
                onClose={() => setIsMobileInfoOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Conversation List */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.id || null}
              currentUserId={userId}
              isLoading={isLoadingConversations}
              onSelect={handleSelectConversation}
              onNewConversation={() => setIsNewConversationOpen(true)}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Message Thread */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              currentUserId={userId}
              isLoading={isLoadingMessages}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onSendMessage={sendMessage}
              onTyping={setTyping}
              typingUsers={typingUsers}
              onMarkRead={handleMarkRead}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Info Pane */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <PatientInfoPane
              conversation={selectedConversation}
              currentUserId={userId}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile Message Thread */}
      <div className="md:hidden flex-1 min-h-0">
        <MessageThread
          conversation={selectedConversation}
          messages={messages}
          currentUserId={userId}
          isLoading={isLoadingMessages}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSendMessage={sendMessage}
          onTyping={setTyping}
          typingUsers={typingUsers}
          onMarkRead={handleMarkRead}
        />
      </div>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={isNewConversationOpen}
        onOpenChange={setIsNewConversationOpen}
        currentUserId={userId}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
