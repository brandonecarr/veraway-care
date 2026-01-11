'use client';

import { useState, useEffect, useCallback } from 'react';

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface UseMessageTemplatesReturn {
  templates: MessageTemplate[];
  isLoading: boolean;
  addTemplate: (name: string, content: string) => void;
  updateTemplate: (id: string, name: string, content: string) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => MessageTemplate | undefined;
}

const STORAGE_KEY = 'message-templates';

/**
 * Hook for managing message templates stored in localStorage
 */
export function useMessageTemplates(): UseMessageTemplatesReturn {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading message templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage helper
  const persistToStorage = useCallback((newTemplates: MessageTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
    } catch (error) {
      console.error('Error saving message templates:', error);
    }
  }, []);

  const addTemplate = useCallback((name: string, content: string) => {
    const newTemplate: MessageTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTemplates(prev => {
      const newTemplates = [...prev, newTemplate];
      persistToStorage(newTemplates);
      return newTemplates;
    });
  }, [persistToStorage]);

  const updateTemplate = useCallback((id: string, name: string, content: string) => {
    setTemplates(prev => {
      const newTemplates = prev.map(template =>
        template.id === id
          ? {
              ...template,
              name: name.trim(),
              content: content.trim(),
              updatedAt: new Date().toISOString(),
            }
          : template
      );
      persistToStorage(newTemplates);
      return newTemplates;
    });
  }, [persistToStorage]);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const newTemplates = prev.filter(template => template.id !== id);
      persistToStorage(newTemplates);
      return newTemplates;
    });
  }, [persistToStorage]);

  const getTemplate = useCallback((id: string) => {
    return templates.find(template => template.id === id);
  }, [templates]);

  return {
    templates,
    isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  };
}
