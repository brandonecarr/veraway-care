'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import type { ReportTemplate } from '@/hooks/use-report-templates';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReportTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ReportTemplate[];
  onAdd: (name: string, content: string) => void;
  onUpdate: (id: string, name: string, content: string) => void;
  onDelete: (id: string) => void;
}

type ViewMode = 'list' | 'add' | 'edit';

export function ReportTemplatesDialog({
  open,
  onOpenChange,
  templates,
  onAdd,
  onUpdate,
  onDelete,
}: ReportTemplatesDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setContent('');
    setEditingTemplate(null);
    setDeleteConfirmId(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
      setViewMode('list');
    }
    onOpenChange(open);
  };

  const handleAdd = () => {
    resetForm();
    setViewMode('add');
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setContent(template.content);
    setViewMode('edit');
  };

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;

    if (viewMode === 'add') {
      onAdd(name, content);
    } else if (viewMode === 'edit' && editingTemplate) {
      onUpdate(editingTemplate.id, name, content);
    }

    resetForm();
    setViewMode('list');
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) {
      onDelete(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const handleBack = () => {
    resetForm();
    setViewMode('list');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2D7A7A]" />
            {viewMode === 'list' && 'Report Templates'}
            {viewMode === 'add' && 'Create New Template'}
            {viewMode === 'edit' && 'Edit Template'}
          </DialogTitle>
          <DialogDescription>
            {viewMode === 'list' && 'Create and manage reusable report note templates.'}
            {viewMode === 'add' && 'Create a new report note template for quick use.'}
            {viewMode === 'edit' && 'Update your report note template.'}
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'list' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={handleAdd}
                size="sm"
                className="bg-[#2D7A7A] hover:bg-[#236060]"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No templates yet</p>
                <p className="text-xs mt-1">Create your first template to get started.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-3 border border-[#D4D4D4] rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-[#1A1A1A] truncate">
                            {template.name}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {template.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Updated {format(new Date(template.updatedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                            className={cn(
                              "h-8 w-8 p-0",
                              deleteConfirmId === template.id
                                ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                : "text-muted-foreground hover:text-red-600"
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {deleteConfirmId === template.id && (
                        <p className="text-xs text-red-600 mt-2">
                          Click delete again to confirm
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Handoff, Weekend Summary"
                className="border-[#D4D4D4]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">Report Notes Content</Label>
              <Textarea
                id="template-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your template report notes here..."
                rows={6}
                className="resize-none border-[#D4D4D4]"
              />
            </div>

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || !content.trim()}
                className="bg-[#2D7A7A] hover:bg-[#236060]"
              >
                {viewMode === 'add' ? 'Create Template' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
