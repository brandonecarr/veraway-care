'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Send, FileText, Settings } from 'lucide-react';
import { useMessageTemplates } from '@/hooks/use-message-templates';
import { MessageTemplatesDialog } from './message-templates-dialog';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  } = useMessageTemplates();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);

      if (onTyping) {
        onTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      }
    },
    [onTyping]
  );

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return;

    const content = message.trim();
    setMessage('');
    setIsSending(true);

    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    try {
      await onSend(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(content);
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, onSend, onTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSelectTemplate = useCallback((content: string) => {
    setMessage(content);
    // Focus the textarea so user can edit before sending
    setTimeout(() => {
      textareaRef.current?.focus();
      // Move cursor to end of text
      if (textareaRef.current) {
        textareaRef.current.selectionStart = content.length;
        textareaRef.current.selectionEnd = content.length;
      }
    }, 0);
  }, []);

  const handleOpenManageTemplates = useCallback(() => {
    // Close dropdown first, then open dialog after a short delay
    // This prevents portal conflicts between DropdownMenu and Dialog
    setIsDropdownOpen(false);
    setTimeout(() => {
      setIsTemplatesDialogOpen(true);
    }, 100);
  }, []);

  return (
    <>
      <div className="p-4 border-t border-[#D4D4D4] bg-[#FAFAF8]">
        <div className="flex gap-2">
          {/* Template Button */}
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "shrink-0 h-auto min-h-[60px] border-[#D4D4D4]",
                  templates.length > 0 && "border-[#2D7A7A]/30"
                )}
                disabled={disabled || isSending}
                title="Message Templates"
              >
                <FileText className={cn(
                  "w-4 h-4",
                  templates.length > 0 ? "text-[#2D7A7A]" : "text-muted-foreground"
                )} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {templates.length > 0 ? (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Select a template
                  </div>
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.content)}
                      className="flex flex-col items-start gap-0.5 cursor-pointer"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {template.content}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No templates yet
                </div>
              )}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleOpenManageTemplates();
                }}
                className="cursor-pointer"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Templates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Message Input */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            className="resize-none border-[#D4D4D4] text-sm bg-white"
            disabled={disabled || isSending}
          />

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending || disabled}
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

      {/* Templates Management Dialog */}
      <MessageTemplatesDialog
        open={isTemplatesDialogOpen}
        onOpenChange={setIsTemplatesDialogOpen}
        templates={templates}
        onAdd={addTemplate}
        onUpdate={updateTemplate}
        onDelete={deleteTemplate}
      />
    </>
  );
}
