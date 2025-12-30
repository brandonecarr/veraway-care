'use client';

import type { User } from '@/types/messages';

interface TypingIndicatorProps {
  users: User[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names =
    users.length === 1
      ? users[0].name || users[0].email.split('@')[0]
      : users.length === 2
        ? `${users[0].name || users[0].email.split('@')[0]} and ${users[1].name || users[1].email.split('@')[0]}`
        : `${users[0].name || users[0].email.split('@')[0]} and ${users.length - 1} others`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-[#2D7A7A] rounded-full animate-bounce" />
        <span
          className="w-2 h-2 bg-[#2D7A7A] rounded-full animate-bounce"
          style={{ animationDelay: '0.1s' }}
        />
        <span
          className="w-2 h-2 bg-[#2D7A7A] rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        />
      </div>
      <span>{names} typing...</span>
    </div>
  );
}
