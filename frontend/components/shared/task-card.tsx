"use client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Task } from "@/types/Tasks";
import { PriorityLabel } from "./priority-label";
import { Button } from "../ui/button";
import { CheckCircle, CheckLine, Trash } from "lucide-react";

export const TaskCard = ({
  task,
  markTaskAsCompleted,
  deleteTask,
}: {
  task: Task;
  markTaskAsCompleted: (taskId: number) => void;
  deleteTask: (taskId: number) => void;
}) => {
  return (
    <Card data-testid="task-card" className="gap-0">
      <CardHeader>
        <CardTitle data-testid="task-title" className="flex justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold line-clamp-2 truncate max-w-[250px]">
              {task.title}
            </span>
            <PriorityLabel priority={task.priority} />
          </div>

          <div className="flex items-center gap-2">
            <span data-testid="task-due-date" className="text-sm text-gray-400">
              {task.due_date && new Date(task.due_date).toLocaleDateString()}
            </span>
            <Button
              data-testid="delete-task"
              className="cursor-pointer"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                deleteTask(task.id);
              }}
            >
              <Trash className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-32">
        <p
          data-testid="task-description"
          className="max-h-24 text-left text-ellipsis overflow-hidden text-gray-600 text-sm"
        >
          {task.description}
        </p>
      </CardContent>
      <CardFooter>
        {task.completed ? (
          <Button
            data-testid="completed-indicator"
            className="text-sm w-full py-6"
            variant="success"
          >
            Completed <CheckCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            data-testid="mark-task-as-completed"
            className="text-sm w-full py-6 text-gray-600"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              markTaskAsCompleted(task.id);
            }}
          >
            Mark as completed <CheckLine className="h-4 w-4 text-green-500" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
