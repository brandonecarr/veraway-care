'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Issue, IssueMessage } from '@/types/care-coordination';

interface MobileCommunicationSheetProps {
  issue: Issue | null;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileCommunicationSheet({
  issue,
  currentUserId,
  open,
  onOpenChange,
}: MobileCommunicationSheetProps) {
  const [messages, setMessages] = useState<IssueMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (issue?.id && open) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [issue?.id, open]);

  const fetchMessages = async () => {
    if (!issue) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!issue || !newMessage.trim()) return;

    const optimisticMessage: IssueMessage = {
      id: `temp-${Date.now()}`,
      issue_id: issue.id,
      user_id: currentUserId,
      message: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setIsSending(true);

    try {
      const response = await fetch(`/api/issues/${issue.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticMessage.id ? savedMessage : msg
          )
        );
        toast.success('Message sent');
      } else {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== optimisticMessage.id)
        );
        toast.error('Failed to send message');
      }
    } catch (error) {
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id)
      );
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return '?';
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  if (!issue) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg">
                Issue #{issue.issue_number}
              </DrawerTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {issue.patient?.first_name} {issue.patient?.last_name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchMessages}
              disabled={isLoading}
              className="h-9 w-9"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 py-4">
            {isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwnMessage = message.user_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-3',
                        isOwnMessage && 'flex-row-reverse'
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-[#2D7A7A]/10 text-[#2D7A7A]">
                          {getInitials(message.user?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'flex flex-col max-w-[75%]',
                          isOwnMessage && 'items-end'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {isOwnMessage ? 'You' : message.user?.email?.split('@')[0] || 'User'}
                          </span>
                          {message.user?.role && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {message.user.role}
                            </Badge>
                          )}
                        </div>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-2',
                            isOwnMessage
                              ? 'bg-[#2D7A7A] text-white rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-4 bg-background">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[44px] max-h-[120px] resize-none text-base"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                size="icon"
                className="h-11 w-11 flex-shrink-0 bg-[#2D7A7A] hover:bg-[#236060] active:scale-95 transition-transform touch-manipulation"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
