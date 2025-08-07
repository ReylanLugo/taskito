import { createSlice } from "@reduxjs/toolkit";
import {
  Comment,
  Task,
  TaskFilters,
  TaskPagination,
  TaskStatistics,
} from "@/types/Tasks";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface TaskState {
  tasks: Task[];
  tasksFilters: TaskFilters;
  pagination: TaskPagination;
  statistics: TaskStatistics;
}

const initialState: TaskState = {
  tasks: [],
  tasksFilters: {},
  pagination: {
    page: 1,
    size: 20,
    total_pages: 0,
  },
  statistics: {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    overdue_tasks: 0,
    high_priority_tasks: 0,
    medium_priority_tasks: 0,
    low_priority_tasks: 0,
  },
};

export const taskSlice = createSlice({
  name: "task",
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.tasks = action.payload;
    },
    setTasksFilters: (state, action: PayloadAction<TaskFilters>) => {
      state.tasksFilters = action.payload;
    },
    addTask: (state, action: PayloadAction<Task>) => {
      state.tasks.unshift(action.payload);
      state.statistics.total_tasks += 1;
      state.statistics.pending_tasks += 1;
      switch (action.payload.priority) {
        case "baja":
          state.statistics.low_priority_tasks += 1;
          break;
        case "media":
          state.statistics.medium_priority_tasks += 1;
          break;
        case "alta":
          state.statistics.high_priority_tasks += 1;
          break;
      }
    },
    setStatistics: (state, action: PayloadAction<TaskStatistics>) => {
      state.statistics = action.payload;
    },
    setPagination: (state, action: PayloadAction<TaskPagination>) => {
      state.pagination = action.payload;
    },
    markTaskAsCompleted: (state, action: PayloadAction<number>) => {
      const taskId = action.payload;
      const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex !== -1) {
        state.tasks[taskIndex].completed = true;
        state.statistics.completed_tasks += 1;
        state.statistics.pending_tasks -= 1;
      }
    },
    updateTask: (state, action: PayloadAction<Task>) => {
      const task = action.payload;
      const taskIndex = state.tasks.findIndex((task) => task.id === task.id);
      if (taskIndex !== -1) {
        state.tasks[taskIndex] = task;
      }
    },
    deleteTask: (state, action: PayloadAction<number>) => {
      const taskId = action.payload;
      const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex !== -1) {
        if (state.tasks[taskIndex].completed) {
          state.statistics.completed_tasks -= 1;
        } else {
          state.statistics.pending_tasks -= 1;
        }
        state.tasks.splice(taskIndex, 1);
        state.statistics.total_tasks -= 1;
      }
    },
    addComment: (
      state,
      action: PayloadAction<{ taskId: number; comment: Comment }>
    ) => {
      const { taskId, comment } = action.payload;
      const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
      if (taskIndex !== -1) {
        state.tasks[taskIndex].comments.push(comment);
      }
    },
  },
});

export const {
  setTasks,
  addTask,
  setStatistics,
  setPagination,
  setTasksFilters,
  markTaskAsCompleted,
  deleteTask,
  addComment,
  updateTask,
} = taskSlice.actions;
export default taskSlice.reducer;
