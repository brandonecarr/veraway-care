'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { User as UserType, ConversationWithDetails } from '@/types/messages';
import { cn } from '@/lib/utils';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationCreated: (conversation: ConversationWithDetails) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [tab, setTab] = useState<'direct' | 'group'>('direct');

  // Fetch users
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch('/api/users?all=true')
        .then((res) => res.json())
        .then((data) => {
          setUsers(
            (data.users || []).filter((u: UserType) => u.id !== currentUserId)
          );
        })
        .catch((error) => {
          console.error('Failed to fetch users:', error);
          toast.error('Failed to load users');
        })
        .finally(() => setIsLoading(false));
    } else {
      // Reset state when dialog closes
      setSelectedUsers([]);
      setGroupName('');
      setSearchQuery('');
      setTab('direct');
    }
  }, [open, currentUserId]);

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const handleUserSelect = (userId: string) => {
    if (tab === 'direct') {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    if (tab === 'group' && !groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: tab,
          name: tab === 'group' ? groupName.trim() : undefined,
          participant_ids: selectedUsers,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      toast.success(
        tab === 'direct' ? 'Direct message started' : 'Group created'
      );
      onConversationCreated(conversation);
      onOpenChange(false);
    } catch (error) {
      console.error('Create conversation error:', error);
      toast.error('Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a direct message or create a group chat
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Group Chat
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Group Name (only for groups) */}
            {tab === 'group' && (
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* User List */}
            <ScrollArea className="h-[240px] border rounded-md">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2D7A7A]" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {searchQuery ? 'No users found' : 'No team members available'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-md transition-colors',
                          isSelected
                            ? 'bg-[#2D7A7A]/10'
                            : 'hover:bg-[#FAFAF8]'
                        )}
                      >
                        {tab === 'group' && (
                          <Checkbox
                            checked={isSelected}
                            className="pointer-events-none"
                          />
                        )}
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#2D7A7A]/10 text-[#2D7A7A] text-xs">
                            {user.name?.[0]?.toUpperCase() ||
                              user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-[#1A1A1A] truncate">
                            {user.name || user.email.split('@')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        {tab === 'direct' && isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#2D7A7A]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Selected count for groups */}
            {tab === 'group' && selectedUsers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedUsers.length} member
                {selectedUsers.length !== 1 ? 's' : ''} selected
              </p>
            )}

            {/* Create Button */}
            <Button
              onClick={handleCreate}
              disabled={
                isCreating ||
                selectedUsers.length === 0 ||
                (tab === 'group' && !groupName.trim())
              }
              className="w-full bg-[#2D7A7A] hover:bg-[#236060]"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {tab === 'direct' ? 'Start Conversation' : 'Create Group'}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
