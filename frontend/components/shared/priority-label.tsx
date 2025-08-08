import { TaskPriority } from "@/types/Tasks";
import { Label } from "../ui/label";
import { cn } from "@/lib/utils";

export const PriorityLabel = ({ priority }: { priority: TaskPriority }) => {
  const color = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return "bg-red-500 text-white";
      case TaskPriority.MEDIUM:
        return "bg-yellow-500 text-white";
      case TaskPriority.LOW:
        return "bg-blue-500 text-white";
    }
  };

  const text = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return "High";
      case TaskPriority.MEDIUM:
        return "Medium";
      case TaskPriority.LOW:
        return "Low";
    }
  };

  return (
    <Label data-testid="priority-label">
      <span data-testid="priority-text" className={cn("text-xs px-2 py-1 rounded-full", color(priority))}>
        {text(priority)}
      </span>
    </Label>
  );
};
