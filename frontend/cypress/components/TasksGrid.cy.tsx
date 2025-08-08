// cypress/component/TasksGrid.cy.tsx
import React from "react";
import TasksGrid from "../../components/dashboard/TasksGrid/index";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "../../lib/store/slices/tasks";
import usersReducer from "../../lib/store/slices/users";
import { TaskPriority } from "../../types/Tasks";
import authReducer from "../../lib/store/slices/auth";
import "@/app/globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Role } from "@/types/User";

describe("TasksGrid Component", () => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      task: tasksReducer,
      users: usersReducer,
    },
    preloadedState: {
      auth: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: Role.USER,
        is_active: true,
        created_at: "2025-08-01T00:00:00Z",
        updated_at: "2025-08-01T00:00:00Z",
        csrfToken: "test-csrf-token",
      },
      task: {
        tasks: [
          {
            id: 1,
            title: "Test task",
            description: "This is a test task",
            completed: false,
            priority: TaskPriority.HIGH,
            due_date: "2025-09-01T00:00:00Z",
            created_by: 1,
            assigned_to: 1,
            comments: [],
            created_at: "2025-08-01T00:00:00Z",
            updated_at: "2025-08-01T00:00:00Z",
          },
          {
            id: 2,
            title: "Test task",
            description: "This is a test task",
            completed: false,
            priority: TaskPriority.HIGH,
            due_date: "2025-09-01T00:00:00Z",
            created_by: 12,
            assigned_to: 12,
            comments: [],
            created_at: "2025-08-01T00:00:00Z",
            updated_at: "2025-08-01T00:00:00Z",
          },
        ],
        pagination: {
          page: 1,
          size: 10,
          total_pages: 1,
        },
        tasksFilters: {},
        statistics: {
          total_tasks: 1,
          completed_tasks: 0,
          pending_tasks: 1,
          overdue_tasks: 0,
          high_priority_tasks: 1,
          medium_priority_tasks: 0,
          low_priority_tasks: 0,
        },
      },
      users: {
        users: [
          {
            id: 1,
            username: "testuser",
            email: "test@example.com",
            role: Role.USER,
            is_active: true,
            created_at: "2025-08-01T00:00:00Z",
            updated_at: "2025-08-01T00:00:00Z",
          },
        ],
      },
    },
  });

  const mountComponent = () => {
    cy.mount(
      <Provider store={store}>
        <Toaster />
        <TasksGrid />
      </Provider>
    );
  };

  beforeEach(() => {
    cy.viewport(1000, 800);
    // Mock API calls
    cy.intercept("GET", "/api/tasks*", { fixture: "tasks.json" }).as(
      "getTasks"
    );
    cy.intercept("PUT", "/api/tasks/*", { statusCode: 200 }).as("completeTask");
    cy.intercept("DELETE", "/api/tasks/*", { statusCode: 204 }).as(
      "deleteTask"
    );
    cy.intercept("POST", "/api/tasks/*/comments", { statusCode: 201 }).as(
      "addComment"
    );

    // Mount component with Redux provider
    mountComponent();
  });

  it("renders task cards", () => {
    cy.get('[data-testid="task-card"]').should("exist");
  });

  it("shows toolbar with filters", () => {
    cy.get('[data-testid="task-toolbar"]').should("exist");
    cy.get('[data-testid="search-input"]').should("exist");
    cy.get('[data-testid="completion-filter"]').should("exist");
    cy.get('[data-testid="priority-filter"]').should("exist");
  });

  it("allows marking a task as completed", () => {
    // Click the complete task button
    cy.get('[data-testid="mark-task-as-completed"]').first().click();

    // Verify the API was called
    cy.wait("@completeTask");

    // Check for success toast with Sonner's structure
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]").contains(/Task|marked|completed/i, {
      matchCase: false,
    });
  });

  it("allows deleting a task", () => {
    // Click the delete task button
    cy.get('[data-testid="delete-task"]').first().click();

    // Verify the API was called
    cy.wait("@deleteTask");

    // Check for success toast with Sonner's structure
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Task deleted successfully/i, {
        matchCase: false,
      })
      .should("exist");
  });

  it("allows adding a comment to a task", () => {
    // Click on the task to open details dialog
    cy.get('[data-testid="task-card"]').first().click();

    // Type a comment
    cy.get('[data-testid="comment-input"]').type("This is a test comment");

    // Submit the comment - force click since it might be hidden
    cy.get('[data-testid="submit-comment"]').click({ force: true });

    // Verify the API was called
    cy.wait("@addComment");

    // Check for success toast with Sonner's structure
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Comment added successfully/i, {
        matchCase: false,
      })
      .should("exist");
  });

  it("shows empty state when no tasks are available", () => {
    // Create a store with empty tasks
    const emptyStore = configureStore({
      reducer: {
        auth: authReducer,
        task: tasksReducer,
        users: usersReducer,
      },
      preloadedState: {
        ...store.getState(),
        task: {
          ...store.getState().task,
          tasks: [],
        },
      },
    });

    // Mount with empty store
    cy.mount(
      <Provider store={emptyStore}>
        <TasksGrid />
      </Provider>
    );

    // Check for empty state message
    cy.contains("No tasks found").should("be.visible");
  });

  it("shows loading indicators when loading more tasks", () => {
    // Setup a store with pagination indicating more pages
    const paginatedStore = configureStore({
      reducer: {
        auth: authReducer,
        task: tasksReducer,
        users: usersReducer,
      },
      preloadedState: {
        ...store.getState(),
        task: {
          ...store.getState().task,
          pagination: {
            page: 1,
            size: 10,
            total_pages: 3,
          },
        },
      },
    });

    // Mock the response for more tasks
    cy.intercept("GET", "/api/tasks/*", (req) => {
      req.reply({
        delay: 700, // add delay so skeletons are visible
        body: {
          tasks: [
            {
              id: 2,
              title: "Another task",
              description: "This is a second test task",
              completed: false,
              priority: TaskPriority.MEDIUM,
              due_date: "2025-09-10T00:00:00Z",
              created_by: 1,
              assigned_to: 1,
              comments: [],
              created_at: "2025-08-02T00:00:00Z",
              updated_at: "2025-08-02T00:00:00Z",
            },
          ],
          page: 2,
          size: 10,
          pages: 3,
        },
      });
    }).as("loadMoreTasks");

    // Mount with paginated store (was removed by mistake)
    cy.mount(
      <Provider store={paginatedStore}>
        <TasksGrid />
      </Provider>
    );

    // Manually trigger loading more tasks by ensuring the sentinel enters viewport
    cy.get("[data-testid='last-task-ref']").scrollIntoView({
      easing: "linear",
      duration: 0,
    });

    cy.scrollTo("bottom");

    // Check for loading indicators
    cy.get("[data-testid='task-skeleton']").should("be.visible");
  });

  it("handles errors when API calls fail", () => {
    // Setup error intercepts
    cy.intercept("PUT", "/api/tasks/*", {
      statusCode: 500,
      body: { detail: "Server error" },
    }).as("completeTaskError");

    // Remount component
    mountComponent();

    // Attempt to mark task as completed
    cy.get('[data-testid="mark-task-as-completed"]').first().click();

    // Verify error toast appeared
    cy.wait("@completeTaskError");
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Server error/i, {
        matchCase: false,
      })
      .should("exist");
  });

  it("displays task details correctly", () => {
    // Click on task card to open details dialog
    cy.get('[data-testid="task-card"]').first().click();

    // Verify task details content is visible
    cy.contains("Task Details").should("be.visible");
    cy.contains("Test task").should("be.visible");
    cy.contains("This is a test task").should("be.visible");

    // Task priority should be visible
    cy.contains("High").should("be.visible");
  });

  it("respects user role permissions", () => {
    // Create a store with non-admin user who didn't create the task
    const nonOwnerStore = configureStore({
      reducer: {
        auth: authReducer,
        task: tasksReducer,
        users: usersReducer,
      },
      preloadedState: {
        ...store.getState(),
        auth: {
          ...store.getState().auth,
          id: 2, // Different user ID than task creator
          role: Role.USER,
        },
        task: {
          ...store.getState().task,
          tasks: [
            {
              ...store.getState().task.tasks[0],
              created_by: 1, // Original creator ID
            },
          ],
        },
      },
    });

    // Mount with non-owner store
    cy.mount(
      <Provider store={nonOwnerStore}>
        <TasksGrid />
      </Provider>
    );

    // Open task details
    cy.get('[data-testid="task-card"]').first().click();

    // Edit button should not be visible for non-owner, non-admin users
    cy.get('[data-testid="task-edit-button"]').should("not.exist");
  });
});
