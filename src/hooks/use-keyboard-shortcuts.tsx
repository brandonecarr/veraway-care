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
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey;
        const metaMatch = shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey;
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey;

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
    key: 'k',
    metaKey: true,
    callback: () => {
      const searchInput = document.querySelector('[role="combobox"]') as HTMLInputElement;
      searchInput?.focus();
    },
    description: 'Search issues',
  },
  {
    key: 'n',
    metaKey: true,
    callback: () => {
      const fabButton = document.querySelector('[aria-label="Report new issue"]') as HTMLButtonElement;
      fabButton?.click();
    },
    description: 'New issue',
  },
];
