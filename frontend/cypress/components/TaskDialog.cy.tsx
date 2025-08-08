import React from "react";
import "@/app/globals.css";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import { TaskDialog } from "@/components/admin/task-dialog";
import { Role } from "@/types/User";
import { Task } from "@/types/Tasks";
import { TaskPriority } from "@/types/Tasks";

// Minimal helper to create a Task
const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: overrides.id ?? 1,
  title: overrides.title ?? "Task title",
  description: overrides.description ?? "Some description",
  completed: overrides.completed ?? false,
  due_date: overrides.due_date ?? new Date().toISOString(),
  priority: overrides.priority ?? TaskPriority.MEDIUM,
  created_by: overrides.created_by ?? 1,
  assigned_to: overrides.assigned_to ?? 2,
  comments: overrides.comments ?? [],
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
});

// Mini store like other specs
const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

const makeStore = (preloaded?: any) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        id: 1,
        username: "tester",
        email: "tester@example.com",
        role: Role.ADMIN,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        csrfToken: "test-csrf-token",
      },
      task: {
        tasks: [],
        pagination: { page: 1, size: 10, total_pages: 1 },
        tasksFilters: {},
        statistics: {
          total_tasks: 0,
          completed_tasks: 0,
          pending_tasks: 0,
          overdue_tasks: 0,
          high_priority_tasks: 0,
          medium_priority_tasks: 0,
          low_priority_tasks: 0,
        },
      },
      users: { users: [] },
      ...(preloaded || {}),
    },
  });

// Close a dialog by its data-testid using Escape
const closeDialogByTestId = (testId: string) => {
  cy.get(`[data-testid="${testId}"]`).should('be.visible').click('topLeft', { force: true }).type('{esc}');
};

describe("TaskDialog", () => {
  beforeEach(() => {
    cy.viewport(1000, 900);
  });

  it("renders fallback message with default title when no task is provided", () => {
    const onOpenChange = cy.stub().as("onOpenChange");

    cy.mount(
      <Provider store={makeStore()}>
        <TaskDialog open={true} onOpenChange={onOpenChange} task={null} />
      </Provider>
    );

    // Default title should be "Task"
    cy.contains("h2, h3, h4", "Task").should("be.visible");
    cy.contains("No task selected").should("be.visible");

    // Close outer TaskDialog deterministically
    cy.get('[data-testid="task-dialog"]').should('be.visible');
    closeDialogByTestId('task-dialog');
    cy.get("@onOpenChange").should("have.been.calledWith", false);
  });

  it("renders TaskCard and TaskDetails trigger when a task is provided and respects custom title", () => {
    const onOpenChange = cy.stub().as("onOpenChange");
    const task = makeTask({ id: 42, title: "Important Task" });

    cy.mount(
      <Provider store={makeStore()}>
        <TaskDialog
          open={true}
          onOpenChange={onOpenChange}
          task={task}
          title="Task Preview"
        />
      </Provider>
    );

    // Custom title rendered
    cy.contains("h2, h3, h4", "Task Preview").should("be.visible");

    // Compact TaskCard preview is rendered (title should appear)
    cy.contains(/Important Task/i).should("be.visible");

    // Open inner TaskDetails via test id
    cy.get('[data-testid="open-task-details"]').should('be.visible').click();
    // Close inner TaskDetails, then outer TaskDialog using test ids
    cy.get('[data-testid="task-details-dialog"]').should('be.visible');
    closeDialogByTestId('task-details-dialog');
    closeDialogByTestId('task-dialog');
    cy.get("@onOpenChange").should("have.been.calledWith", false);
  });
});
