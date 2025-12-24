'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  callback: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      const isTyping = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('[role="combobox"]');
      
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey;
        const metaMatch = shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey;
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey;

        // For shortcuts without modifiers (like '/'), skip if typing
        const hasModifier = shortcut.ctrlKey || shortcut.metaKey || shortcut.shiftKey;
        if (!hasModifier && isTyping && event.key !== 'Escape') {
          continue;
        }

        if (
          event.key === shortcut.key &&
          ctrlMatch &&
          metaMatch &&
          shiftMatch
        ) {
          event.preventDefault();
          shortcut.callback();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const GLOBAL_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '/',
    callback: () => {
      const searchInput = document.querySelector('[role="combobox"]') as HTMLInputElement;
      searchInput?.focus();
    },
    description: 'Search issues',
  },
  {
    key: 'n',
    shiftKey: true,
    callback: () => {
      const fabButton = document.querySelector('[aria-label="Report new issue"]') as HTMLButtonElement;
      fabButton?.click();
    },
    description: 'New issue',
  },
  {
    key: 'Escape',
    callback: () => {
      const activeElement = document.activeElement as HTMLElement;
      activeElement?.blur();
    },
    description: 'Close / Unfocus',
  },
];
