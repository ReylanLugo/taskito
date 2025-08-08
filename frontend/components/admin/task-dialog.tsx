"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TaskDetails from "@/components/shared/task-details";
import { TaskCard } from "@/components/shared/task-card";

export type TaskDto = {
  id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  due_date?: string | null;
  priority?: string;
  created_by: number;
  assigned_to?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDto | null;
  title?: string;
};

export function TaskDialog({
  open,
  onOpenChange,
  task,
  title = "Task",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="task-dialog" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="space-y-4">
            {/* Compact card preview */}
            <TaskCard
              task={task as any}
              // Provide no-op handlers to satisfy TaskCard API in shared component
              markTaskAsCompleted={() => {}}
              deleteTask={() => {}}
            />
            {/* Button to open full TaskDetails dialog (component controls its own dialog) */}
            <TaskDetails task={task as any} addComment={() => {}}>
              <button data-testid="open-task-details" className="text-sm underline text-blue-600">
                Open full details (preview mode)
              </button>
            </TaskDetails>
          </div>
        ) : (
          <p className="text-center">No task selected</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
