'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div className="p-4 border-t border-[#D4D4D4] bg-[#FAFAF8]">
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="resize-none border-[#D4D4D4] text-sm bg-white"
          disabled={disabled || isSending}
        />
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
  );
}
