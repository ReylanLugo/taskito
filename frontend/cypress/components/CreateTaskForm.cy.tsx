import React from "react";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import CreateTaskForm from "@/components/dashboard/TasksGrid/create-task-form";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";
import { AppStore } from "@/lib/store";
import { Role } from "@/types/User";

// Helper to mount the component with a basic store state
const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

const makeStore = (preloaded?: AppStore) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        id: 1,
        username: "tester",
        email: "tester@example.com",
        role: Role.ADMIN,
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
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
      users: {
        users: [
          {
            id: 1,
            username: "testuser",
            email: "test@example.com",
            role: Role.USER,
            is_active: true,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
      },
      ...(preloaded || {}),
    },
  });

const mountWithStore = (store: ReturnType<typeof makeStore>) => {
  cy.mount(
    <Provider store={store}>
      <Toaster />
      <CreateTaskForm />
    </Provider>
  );
};

describe("CreateTaskForm Component", () => {
  beforeEach(() => {
    cy.viewport(1000, 800);
    // Intercepts for create task
    cy.intercept("POST", "/api/tasks", (req) => {
      // default success
      req.reply({ statusCode: 201 });
    }).as("createTask");
  });

  it("opens dialog and submits successfully", () => {
    const store = makeStore();
    mountWithStore(store);

    // Open dialog
    cy.contains("button", /New Task/i).click();

    // Fill form
    cy.get("input[placeholder='Task title']").type("My new task");
    cy.get("textarea[placeholder='Task description']").type(
      "This is a description"
    );

    // Set priority via Select (shadcn)
    cy.contains("label", /Priority/i).parent().within(() => {
      cy.get("button").click();
    });
    cy.get("[role='option']").contains(/Media|Medium|media/i).click({ force: true });

    // Assigned to via Combobox if present
    cy.contains("label", /Assigned To/i)
      .parent()
      .within(() => {
        // Try to open combobox and select the first option
        cy.get("button, input").first().click({ force: true });
      });
    cy.contains(/testuser/i).click({ force: true });

    // Submit
    cy.contains("button", /Create/i).click();

    cy.wait("@createTask");

    // Success toast
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Task created successfully/i, { matchCase: false })
      .should("exist");
  });

  it("shows validation errors when submitting empty form", () => {
    const store = makeStore();
    mountWithStore(store);

    cy.contains("button", /New Task/i).click();

    // Submit without filling
    cy.contains("button", /Create/i).click();

    // Expect form messages (zod/react-hook-form)
    cy.get("form").within(() => {
      cy.contains(/Title/i).should("exist");
      // Expect at least one error message element to be visible
      cy.get("[role='alert'], .text-destructive, .text-red-500")
        .first()
        .should("exist");
    });
  });

  it("handles API error and shows error toast", () => {
    // Override intercept to return error
    cy.intercept("POST", "/api/tasks", {
      statusCode: 400,
      body: { detail: "Bad request" },
    }).as("createTaskError");

    const store = makeStore();
    mountWithStore(store);

    cy.contains("button", /New Task/i).click();

    // Minimal valid to trigger request (title required)
    cy.get("input[placeholder='Task title']").type("Task with error");

    cy.contains("button", /Create/i).click();

    cy.wait("@createTaskError");

    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Bad request|unexpected error/i, { matchCase: false })
      .should("exist");
  });
});
