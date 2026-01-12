'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ReportTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface UseReportTemplatesReturn {
  templates: ReportTemplate[];
  isLoading: boolean;
  addTemplate: (name: string, content: string) => void;
  updateTemplate: (id: string, name: string, content: string) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => ReportTemplate | undefined;
}

const STORAGE_KEY = 'report-templates';

/**
 * Hook for managing report templates stored in localStorage
 * Separate from message templates to keep contexts distinct
 */
export function useReportTemplates(): UseReportTemplatesReturn {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
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
      console.error('Error loading report templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage helper
  const persistToStorage = useCallback((newTemplates: ReportTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTemplates));
    } catch (error) {
      console.error('Error saving report templates:', error);
    }
  }, []);

  const addTemplate = useCallback((name: string, content: string) => {
    const newTemplate: ReportTemplate = {
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
