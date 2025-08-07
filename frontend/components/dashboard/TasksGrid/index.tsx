import React, {
  useEffect,
  useRef,
  useTransition,
  useState,
  useCallback,
} from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import Toolbar from "./toolbar";
import { TaskCard } from "@/components/shared/task-card";
import useAxiosClient from "@/hooks/useAxiosClient";
import TaskService from "@/services/taskService";
import { toast } from "sonner";
import { AxiosError } from "axios";
import TaskDetails from "@/components/shared/task-details";
import TaskSkeleton from "@/components/shared/task-card-skeleton";
import { useAppDispatch } from "@/lib/store/hooks";
import { setPagination, setTasks } from "@/lib/store/slices/tasks";

export default function TasksGrid() {
  const tasksState = useSelector((state: RootState) => state.task);
  const dispatch = useAppDispatch();
  const api = useAxiosClient();
  const taskService = new TaskService(api);

  // State for loading indicators
  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<boolean>(false);

  // Reference to the last task element for infinite scrolling
  const lastTaskRef = useRef<HTMLDivElement>(null);
  // Reference to the intersection observer
  const observer = useRef<IntersectionObserver | null>(null);

  const markTaskAsCompleted = async (taskId: number) => {
    await taskService
      .markTaskAsCompleted(taskId)
      .then((response) => {
        if (response === 200) {
          toast.success("Task marked as completed");
        }
      })
      .catch((error) => {
        const errorMessage = (error as AxiosError<{ detail?: string }>).response
          ?.data?.detail;
        toast.error(errorMessage || "Error marking task as completed");
      });
  };

  const deleteTask = async (taskId: number) => {
    await taskService
      .deleteTask(taskId)
      .then((response) => {
        if (response === 204) {
          toast.success("Task deleted successfully");
        }
      })
      .catch((error) => {
        const errorMessage = (error as AxiosError<{ detail?: string }>).response
          ?.data?.detail;
        toast.error(errorMessage || "Error deleting task");
      });
  };

  const addComment = async (taskId: number, comment: string) => {
    await taskService
      .addComment(taskId, comment)
      .then((response) => {
        if (response === 201) {
          toast.success("Comment added successfully");
        }
      })
      .catch((error) => {
        const errorMessage = (error as AxiosError<{ detail?: string }>).response
          ?.data?.detail;
        toast.error(errorMessage || "Error adding comment");
      });
  };

  // Function to load more tasks
  const loadMoreTasks = useCallback(async () => {
    if (
      isPending ||
      isLoadingMore ||
      tasksState.pagination.page >= tasksState.pagination.total_pages ||
      error
    ) {
      return;
    }

    try {
      setIsLoadingMore(true);
      // Use the task service to fetch the next page
      startTransition(async () => {
        const response = await taskService.getTasks(
          tasksState.tasksFilters,
          tasksState.pagination.page + 1,
          tasksState.pagination.size
        );
        dispatch(setTasks([...tasksState.tasks, ...response.tasks]));
        dispatch(
          setPagination({
            page: response.page,
            size: response.size,
            total_pages: response.pages,
          })
        );
        setIsLoadingMore(false);
      });
    } catch (error) {
      setIsLoadingMore(false);
      setError(true);
      toast.error("Error loading more tasks");
      console.error("Error loading more tasks:", error);
    }
  }, [
    isPending,
    isLoadingMore,
    tasksState.pagination.page,
    tasksState.pagination.total_pages,
    tasksState.tasksFilters,
    taskService,
    setError,
  ]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    // Disconnect previous observer if exists
    if (observer.current) {
      observer.current.disconnect();
    }

    // Create a new intersection observer
    observer.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // If the last task element is intersecting (visible) and there are more pages
        if (
          entry.isIntersecting &&
          tasksState.pagination.page < tasksState.pagination.total_pages
        ) {
          loadMoreTasks();
        }
      },
      {
        rootMargin: "0px 0px 20px 0px", // Start loading when user is 200px from bottom
      }
    );

    // Observe the last task element if it exists
    if (lastTaskRef.current) {
      observer.current.observe(lastTaskRef.current);
    }

    // Cleanup observer on component unmount
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [
    tasksState.pagination.page,
    tasksState.pagination.total_pages,
    loadMoreTasks,
    tasksState.tasks.length,
  ]);

  return (
    <div className="flex flex-col gap-4 mt-12">
      <Toolbar />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasksState.tasks.map((task) => {
          return (
            <TaskDetails task={task} addComment={addComment}>
              <TaskCard
                task={task}
                markTaskAsCompleted={markTaskAsCompleted}
                deleteTask={deleteTask}
              />
            </TaskDetails>
          );
        })}

        {/* Show skeletons while loading more tasks */}
        {isLoadingMore &&
          tasksState.pagination.page < tasksState.pagination.total_pages && (
            <>
              <TaskSkeleton />
              <TaskSkeleton />
              <TaskSkeleton />
            </>
          )}
      </div>

      <div ref={lastTaskRef} />

      {/* Loading indicator at bottom */}
      {isPending && !isLoadingMore && (
        <div className="text-center py-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        </div>
      )}

      {/* End of list indicator */}
      {!isLoadingMore &&
        tasksState.pagination.page >= tasksState.pagination.total_pages &&
        tasksState.tasks.length > 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            No more tasks to load
          </div>
        )}

      {/* Empty state */}
      {tasksState.tasks.length === 0 && !isLoadingMore && (
        <div className="text-center py-8 col-span-3">
          <p className="text-gray-500 dark:text-gray-400">
            No tasks found. Create a new task to get started!
          </p>
        </div>
      )}
    </div>
  );
}
