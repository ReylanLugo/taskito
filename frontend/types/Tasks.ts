export interface TaskStatistics {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  high_priority_tasks: number;
  medium_priority_tasks: number;
  low_priority_tasks: number;
}

export enum TaskPriority {
  HIGH = "alta",
  MEDIUM = "media",
  LOW = "baja",
}

export interface Comment {
  id: number;
  task_id: number;
  author_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  priority: TaskPriority;
  assigned_to: number;
  created_by: number;
  completed: boolean;
  comments: Comment[];
  created_at: string;
  updated_at: string;
}

/**
 * Interface for task filters.
 */
export interface TaskFilters {
  completed?: boolean;
  priority?: TaskPriority | undefined;
  assigned_to?: number;
  created_by?: number;
  due_before?: string;
  due_after?: string;
  search?: string;
  order_by?: string;
  order_desc?: boolean;
}

export interface TaskPagination {
  page: number;
  size: number;
  total_pages: number;
}
