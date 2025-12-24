'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MessageSquare, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Minimize2,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Issue, IssueMessage } from '@/types/care-coordination';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { ConnectionStatus } from './connection-status';

interface CommunicationPanelProps {
  issue: Issue | null;
  currentUserId: string;
  onClose?: () => void;
  className?: string;
  defaultExpanded?: boolean;
  position?: 'right' | 'bottom';
}

export function CommunicationPanel({
  issue,
  currentUserId,
  onClose,
  className,
  defaultExpanded = true,
  position = 'right'
}: CommunicationPanelProps) {
  const { messages, isConnected, refreshMessages } = useRealtimeMessages(issue?.id || null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!issue || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const response = await fetch(`/api/issues/${issue.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });

      if (response.ok) {
        // Real-time subscription will handle adding the message
        toast.success('Message sent');
      } else {
        toast.error('Failed to send message');
        // Restore message on failure
        setNewMessage(messageText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const statusColors = {
    open: 'bg-[#2D7A7A]/10 text-[#2D7A7A] border-[#2D7A7A]',
    in_progress: 'bg-blue-500/10 text-blue-700 border-blue-500',
    overdue: 'bg-[#E07A5F]/10 text-[#E07A5F] border-[#E07A5F]',
    resolved: 'bg-[#81B29A]/10 text-[#81B29A] border-[#81B29A]',
  };

  if (!issue) {
    return (
      <Card className={cn(
        'glass border-brand-border shadow-glass',
        position === 'right' ? 'w-[380px]' : 'w-full',
        className
      )}>
        <div className="p-6 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-brand-border mb-3" />
          <p className="text-body text-muted-foreground">
            Select an issue to view communication
          </p>
        </div>
      </Card>
    );
  }

  if (isMinimized) {
    return (
      <Card 
        className={cn(
          'glass border-brand-border shadow-glass cursor-pointer hover:shadow-card-hover transition-shadow',
          position === 'right' ? 'w-[380px]' : 'w-full',
          className
        )}
        onClick={() => setIsMinimized(false)}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-brand-teal" />
            <div>
              <span className="font-medium text-body font-mono">#{issue.issue_number}</span>
              <span className="text-metadata text-muted-foreground ml-2">
                {messages.length} messages
              </span>
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'glass border-brand-border shadow-glass flex flex-col',
      position === 'right' ? 'w-[380px] max-h-[600px]' : 'w-full max-h-[400px]',
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-[#D4D4D4] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-[#2D7A7A]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1A1A1A]">#{issue.issue_number}</span>
              <Badge 
                variant="outline" 
                className={cn('text-xs', statusColors[issue.status])}
              >
                {issue.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <ConnectionStatus isConnected={isConnected} showLabel={false} />
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {issue.patient?.first_name} {issue.patient?.last_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refreshMessages}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Messages Area */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="flex-1 flex flex-col min-h-0">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-2 h-auto rounded-none border-b border-[#D4D4D4] shrink-0"
          >
            <span className="text-sm font-medium">
              Messages ({messages.length})
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 mx-auto text-[#D4D4D4] mb-2" />
                <p className="text-sm text-muted-foreground">
                  No messages yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start the conversation below
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isCurrentUser = message.user_id === currentUserId;
                  return (
                    <div 
                      key={message.id} 
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
                          {message.user?.name?.[0]?.toUpperCase() || 
                           message.user?.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        'flex-1 space-y-1 min-w-0 max-w-[70%]',
                        isCurrentUser && 'text-right'
                      )}>
                        <div className={cn(
                          'flex items-baseline gap-2 flex-wrap',
                          isCurrentUser && 'justify-end'
                        )}>
                          <span className="text-sm font-medium text-[#1A1A1A]">
                            {isCurrentUser ? 'You' : (message.user?.name || message.user?.email?.split('@')[0] || 'Unknown')}
                          </span>
                          <span className="text-xs text-[#999] font-mono">
                            {format(new Date(message.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <div className={cn(
                          'rounded-lg p-3 text-sm',
                          isCurrentUser 
                            ? 'bg-[#2D7A7A] text-white' 
                            : 'bg-[#FAFAF8] text-[#666] border border-[#D4D4D4]'
                        )}>
                          <p className="whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* Message Input */}
      <div className="p-4 border-t border-[#D4D4D4] bg-[#FAFAF8] shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            rows={2}
            className="resize-none border-[#D4D4D4] text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isSending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="shrink-0 h-auto min-h-[60px] bg-[#2D7A7A] hover:bg-[#236060]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
}
