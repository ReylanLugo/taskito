"use client";

import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  addTask,
  deleteTask,
  markTaskAsCompleted,
  addComment as addCommentAction,
  updateTask,
  setStatistics,
} from "@/lib/store/slices/tasks";
import { TaskFilters } from "@/types/Tasks";
import { AxiosInstance } from "axios";
import { RootState } from "@/lib/store";
import type { AppDispatch } from "@/lib/store";
import { CreateTaskSchema, UpdateTaskSchema } from "@/lib/schemas/tasksSchemas";

/**
 * Service class for fetching and manipulating tasks.
 *
 * This class provides methods to retrieve and create tasks using an Axios instance
 * for HTTP requests. It manages the current task state, pagination, and filters
 * through the Redux store. The task state is utilized to fetch the correct page
 * and size of the task list, and it updates the store with new task data or
 * pagination information upon successful API responses.
 *
 * @example
 * const taskService = new TaskService(axiosInstance);
 * const tasks = await taskService.getTasks();
 * console.log(tasks);
 */
class TaskService {
  /**
   * Axios instance for making HTTP requests.
   */
  private api: AxiosInstance;
  /**
   * Current state of the tasks, including pagination and filters.
   *
   * The task state is obtained from the Redux store using `useAppSelector`.
   * The state is used to determine the correct page and size of the task list
   * when fetching tasks from the API.
   */
  private setTaskState: AppDispatch;
  private csrfToken: string;
  constructor(api: AxiosInstance) {
    this.api = api;
    this.setTaskState = useAppDispatch();
    this.csrfToken = useAppSelector((state: RootState) => state.auth.csrfToken);
  }

  /**
   * Retrieve a list of tasks.
   *
   * @param filters - Optional filters to apply to the task list.
   * @returns Promise that resolves with a list of tasks.
   * @throws Error if there was an error fetching the tasks.
   *
   * Supported filters:
   * - `completed`: boolean to filter by completion status.
   * - `priority`: TaskPriority to filter by priority level.
   * - `assigned_to`: user ID to filter by assigned user.
   * - `created_by`: user ID to filter by creator user.
   * - `due_before`: ISO date string to filter by due date before.
   * - `due_after`: ISO date string to filter by due date after.
   * - `search`: string to search in title and description.
   * - `order_by`: string to order by. Supported fields: `created_at`, `updated_at`, `due_date`, `priority`, `title`.
   * - `order_desc`: boolean to order in descending order.
   */
  async getTasks(filters: TaskFilters = {}, page?: number, size?: number) {
    try {
      const params = {
        ...filters,
        page: page || 1,
        size: size || 10,
      };
      const response = await this.api.get("/tasks/", {
        params,
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Tasks fetched",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      return response.data;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Tasks fetching failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error fetching tasks:", error);
      throw error;
    }
  }

  /**
   * Fetch task statistics from the server.
   *
   * Retrieves comprehensive statistics including:
   * - Total number of tasks
   * - Number of completed tasks
   * - Number of pending tasks
   * - Number of overdue tasks
   * - Tasks by priority level
   *
   * Updates task state with the fetched statistics.
   *
   * @throws Error if there is an issue fetching task statistics.
   */
  async getTasksStatistics() {
    try {
      const response = await this.api.get("/tasks/statistics", {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Tasks statistics fetched",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(setStatistics(response.data));
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Tasks statistics fetching failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error fetching tasks statistics:", error);
      throw error;
    }
  }

  /**
   * Create a new task.
   *
   * @param task - The task data conforming to CreateTaskSchema to be created.
   * @returns Promise that resolves with the created task data.
   * @throws Error if there was an error creating the task.
   */
  async createTask(task: CreateTaskSchema) {
    try {
      const response = await this.api.post("/tasks/", task, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
          "x-csrf-token": this.csrfToken,
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Task created",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(addTask(response.data));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Task creation failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error creating task:", error);
      throw error;
    }
  }

  /**
   * Update a task.
   *
   * @param taskId - The ID of the task to be updated.
   * @param task - The task data conforming to UpdateTaskSchema to be updated.
   * @returns Promise that resolves with the updated task data.
   * @throws Error if there was an error updating the task.
   */
  async updateTask(taskId: number, task: UpdateTaskSchema) {
    try {
      const response = await this.api.put(`/tasks/${taskId}`, task, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
          "x-csrf-token": this.csrfToken,
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Task updated",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(updateTask(response.data));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Task updating failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error updating task:", error);
      throw error;
    }
  }

  /**
   * Marks a task as completed.
   *
   * @param taskId - The ID of the task to be marked as completed.
   * @returns Promise that resolves with the status code of the response.
   * @throws Error if there was an error marking the task as completed.
   */
  async markTaskAsCompleted(taskId: number) {
    try {
      const response = await this.api.put(
        `/tasks/${taskId}`,
        {
          completed: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "no-cache": "true",
            "x-csrf-token": this.csrfToken,
          },
        }
      );
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Task marked as completed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(markTaskAsCompleted(taskId));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Task marking as completed failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error marking task as completed:", error);
      throw error;
    }
  }

  /**
   * Deletes a task.
   *
   * @param taskId - The ID of the task to be deleted.
   * @returns Promise that resolves with the status code of the response.
   * @throws Error if there was an error deleting the task.
   */
  async deleteTask(taskId: number) {
    try {
      const response = await this.api.delete(`/tasks/${taskId}`, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
          "x-csrf-token": this.csrfToken,
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Task deleted",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(deleteTask(taskId));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Task deletion failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error deleting task:", error);
      throw error;
    }
  }

  /**
   * Adds a comment to a specific task.
   *
   * @param taskId - The ID of the task to which the comment is to be added.
   * @param comment - The content of the comment to be added.
   * @returns Promise that resolves with the status code of the response.
   * @throws Error if there was an error adding the comment.
   */
  async addComment(taskId: number, comment: string) {
    try {
      const response = await this.api.post(
        `/tasks/${taskId}/comments`,
        {
          content: comment,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "no-cache": "true",
            "x-csrf-token": this.csrfToken,
          },
        }
      );
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Comment added to task",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setTaskState(addCommentAction({ taskId, comment: response.data }));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Comment adding failed",
          labels: { channel: "tasks" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error adding comment:", error);
      throw error;
    }
  }
}

export default TaskService;
