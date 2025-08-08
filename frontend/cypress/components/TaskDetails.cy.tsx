import React from "react";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import usersReducer from "@/lib/store/slices/users";
import TaskDetails from "@/components/shared/task-details";
import { Task, TaskPriority } from "@/types/Tasks";
import "@/app/globals.css";

const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

type RootState = ReturnType<typeof rootReducer>;

const makeStore = (preloaded?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        id: 10,
        username: "tester",
        email: "tester@example.com",
        role: "user",
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        csrfToken: "csrf",
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
      ...(preloaded as any),
    } as any,
  });

const sampleTask: Task = {
  id: 1,
  title: "Design database schema",
  description: "Create ERD and define indices for critical queries.",
  completed: false,
  priority: TaskPriority.MEDIUM,
  created_by: 10,
  assigned_to: 11,
  comments: [
    {
      id: 1001,
      author_id: 10,
      content: "I'll start with the user tables.",
      created_at: "2025-08-01T09:00:00Z",
      updated_at: "2025-08-01T09:00:00Z",
      task_id: 1,
    },
    {
      id: 1002,
      author_id: 12,
      content: "Remember soft deletes on tasks.",
      created_at: "2025-08-01T10:00:00Z",
      updated_at: "2025-08-01T10:00:00Z",
      task_id: 1,
    },
  ],
  created_at: "2025-08-01T08:00:00Z",
  updated_at: "2025-08-01T11:00:00Z",
  due_date: "2025-08-15T00:00:00Z",
};

describe("TaskDetails", () => {
  const mountDetails = (task: Task = sampleTask, preloaded?: Partial<RootState>) => {
    const store = makeStore(preloaded);
    const onAddComment = cy.spy().as("onAddComment");

    cy.mount(
      <Provider store={store}>
        <TaskDetails task={task} addComment={onAddComment}>
          <button data-testid="open-details">Open</button>
        </TaskDetails>
      </Provider>
    );
  };

  it("opens dialog and shows task info and comments; submits new comment", () => {
    cy.viewport(1000, 800);
    mountDetails();

    // Open the dialog
    cy.get('[data-testid="open-details"]').click();
    cy.contains('Task Details').should('be.visible');

    // Header info
    cy.contains(sampleTask.title).should('be.visible');
    cy.contains(/High|Medium|Low/).should('exist');

    // Description and comments
    cy.contains("Create ERD and define indices for critical queries.").should('be.visible');
    cy.contains("I'll start with the user tables.").should('be.visible');
    cy.contains("Remember soft deletes on tasks.").should('be.visible');

    // Add a comment
    cy.get('[data-testid="comment-input"]').type('New insight about indexing');
    cy.get('[data-testid="submit-comment"]').click();

    cy.get('@onAddComment').should('have.been.calledWith', sampleTask.id, 'New insight about indexing');

    // Input resets
    cy.get('[data-testid="comment-input"]').should('have.value', '');
  });

  it("shows edit dialog trigger only for owner or admin", () => {
    cy.viewport(1000, 800);
    // Case 1: Owner (created_by === currentUser.id)
    mountDetails(sampleTask, { auth: { id: 10, role: 'user' } as any });
    cy.get('[data-testid="open-details"]').click();
    cy.get('[data-testid="task-edit-button"]').should('exist');

    // Case 2: Non-owner non-admin
    // Remount fresh with different auth
    mountDetails(sampleTask, { auth: { id: 99, role: 'user' } as any });
    cy.get('[data-testid="open-details"]').last().click();
    cy.get('[data-testid="task-edit-button"]').should('not.exist');

    // Case 3: Admin
    mountDetails(sampleTask, { auth: { id: 99, role: 'admin' } as any });
    cy.get('[data-testid="open-details"]').last().click();
    cy.get('[data-testid="task-edit-button"]').should('exist');
  });

  it("renders my comments on the right in blue and others on the left in white", () => {
    cy.viewport(1000, 800);
    // currentUser.id = 10 in default store
    mountDetails(sampleTask);
    cy.get('[data-testid="open-details"]').click();

    // My comment (author_id 10) should be right aligned and blue with white text
    cy.contains("I'll start with the user tables.")
      .parents('div')
      .eq(1) // p -> bubble (0) -> alignment row (1)
      .should('have.class', 'justify-end')
      .within(() => {
        cy.contains("I'll start with the user tables.")
          .parent()
          .should('have.class', 'bg-blue-500')
          .and('have.class', 'text-white');
      });

    // Other user's comment should be left aligned and white background
    cy.contains('Remember soft deletes on tasks.')
      .parents('div')
      .eq(1)
      .should('have.class', 'justify-start')
      .within(() => {
        cy.contains('Remember soft deletes on tasks.')
          .parent()
          .should('have.class', 'bg-white');
      });
  });
});
