'use client';

import { useState, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Loader2, MessageSquare } from 'lucide-react';
import { ConversationListItem } from './conversation-list-item';
import type { ConversationWithDetails, ConversationType } from '@/types/messages';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  selectedId: string | null;
  currentUserId: string;
  isLoading: boolean;
  onSelect: (conversation: ConversationWithDetails) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  isLoading,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ConversationType | 'all'>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredConversations = conversations.filter((conv) => {
    // Filter by type
    if (filter !== 'all' && conv.type !== filter) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = conv.name?.toLowerCase() || '';
      const patientName = conv.patient
        ? `${conv.patient.first_name} ${conv.patient.last_name}`.toLowerCase()
        : '';
      const participantNames =
        conv.participants
          ?.map((p) => p.user?.name?.toLowerCase() || p.user?.email?.toLowerCase())
          .join(' ') || '';

      return (
        name.includes(query) ||
        patientName.includes(query) ||
        participantNames.includes(query)
      );
    }

    return true;
  });

  // Virtual scrolling for performance with large lists
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // Approximate height of ConversationListItem
    overscan: 5, // Render 5 items above/below visible area
  });

  // Memoized select handler to prevent unnecessary re-renders
  const handleSelect = useCallback(
    (conversation: ConversationWithDetails) => {
      onSelect(conversation);
    },
    [onSelect]
  );

  return (
    <div className="flex flex-col h-full border-r border-[#D4D4D4] bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#D4D4D4] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#1A1A1A]">Messages</h2>
          <Button
            size="sm"
            onClick={onNewConversation}
            className="bg-[#2D7A7A] hover:bg-[#236060]"
          >
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#FAFAF8] border-[#D4D4D4]"
          />
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="patient" className="text-xs">
              Patients
            </TabsTrigger>
            <TabsTrigger value="direct" className="text-xs">
              Direct
            </TabsTrigger>
            <TabsTrigger value="group" className="text-xs">
              Groups
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversation List - Virtualized for performance */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-[#2D7A7A]" />
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-8 px-4 flex-1">
          <MessageSquare className="w-10 h-10 mx-auto text-[#D4D4D4] mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? 'No conversations found'
              : filter !== 'all'
                ? `No ${filter} conversations`
                : 'No conversations yet'}
          </p>
          {!searchQuery && filter === 'all' && (
            <Button
              variant="link"
              size="sm"
              onClick={onNewConversation}
              className="mt-2 text-[#2D7A7A]"
            >
              Start a conversation
            </Button>
          )}
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
              const conversation = filteredConversations[virtualRow.index];
              return (
                <div
                  key={conversation.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-[#D4D4D4]"
                >
                  <ConversationListItem
                    conversation={conversation}
                    isSelected={conversation.id === selectedId}
                    currentUserId={currentUserId}
                    onClick={() => handleSelect(conversation)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
