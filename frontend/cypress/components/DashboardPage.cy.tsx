import React from "react";
import "@/app/globals.css";
import Dashboard from "@/app/dashboard/page";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Toaster } from "@/components/ui/sonner";

// Minimal test store for component mounting
const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

const makeStore = (preloadedState?: Partial<ReturnType<typeof rootReducer>>) =>
  configureStore({
    reducer: rootReducer,
    // Ensure we can force auth to be empty so the component triggers fetching auth user
    preloadedState: preloadedState as any,
  });

const mountWithStore = (preloadedState?: Partial<ReturnType<typeof rootReducer>>) => {
  const store = makeStore(preloadedState);
  const router = {
    push: cy.stub().as("routerPush"),
    prefetch: cy.stub().resolves(),
    replace: cy.stub(),
    back: cy.stub(),
    forward: cy.stub(),
    refresh: cy.stub(),
  } as any;
  cy.mount(
    <Provider store={store}>
      <Toaster />
      <AppRouterContext.Provider value={router}>
        <Dashboard />
      </AppRouterContext.Provider>
    </Provider>
  );
};

describe("DashboardPage", () => {
  beforeEach(() => {
    cy.viewport(1200, 900);
  });

  it("loads dashboard data and renders stats, charts headings, username, and tasks grid", () => {
    // Stub statistics (glob to allow query params)
    cy.intercept("GET", "/api/tasks/statistics*", {
      statusCode: 200,
      body: {
        total_tasks: 12,
        completed_tasks: 5,
        pending_tasks: 6,
        overdue_tasks: 1,
        high_priority_tasks: 3,
        medium_priority_tasks: 5,
        low_priority_tasks: 4,
      },
    }).as("stats");

    // Stub users list (glob to allow query params)
    cy.intercept("GET", "/api/auth/users*", {
      statusCode: 200,
      body: {
        users: [
          { id: 1, username: "alice", email: "alice@example.com" },
          { id: 2, username: "bob", email: "bob@example.com" },
        ],
      },
    }).as("users");

    cy.intercept(
      { method: "GET", url: /^\/api\/tasks\/(?!statistics)(.*)$/ },
      {
        statusCode: 200,
        body: {
          tasks: [
            {
              id: 101,
              title: "First task",
              description: "Do something",
              due_date: "2025-01-10T00:00:00Z",
              priority: "media", // TaskPriority.MEDIUM
              assigned_to: 2,
              created_by: 99,
              completed: false,
              comments: [],
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
          page: 1,
          size: 10,
          pages: 1,
        },
        headers: { "cache-control": "no-cache" },
      }
    ).as("tasks");

    // Stub auth me to populate username in header (when no auth in store)
    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: 99,
          username: "tester",
          email: "tester@example.com",
          role: "user",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    }).as("me");

    // Force auth slice to be empty so the component executes `if (!auth?.id)`
    mountWithStore({ auth: undefined as any });

    // Wait for initial data calls, including auth/me which should be triggered by the missing auth.id
    cy.wait(["@stats", "@users", "@tasks", "@me"], { timeout: 10000 });

    // Username bubble and name
    cy.contains("p", /^tester$/).should("be.visible");
    cy.contains(/^T$/).should("be.visible"); // initial in the avatar circle

    // Stats numbers visible (avoid coupling to card DOM structure)
    cy.contains("Total Tasks").should("be.visible");
    cy.contains(/^12$/).should("be.visible");
    cy.contains("Completed Tasks").should("be.visible");
    cy.contains(/^5$/).should("be.visible");
    cy.contains("Pending Tasks").should("be.visible");
    cy.contains(/^6$/).should("be.visible");
    cy.contains("Overdue Tasks").should("be.visible");
    cy.contains(/^1$/).should("be.visible");

    // Charts headings rendered (we don't assert chart internals here)
    cy.contains("Task Priority Distribution").should("be.visible");
    cy.contains("Tasks Created This Week").should("be.visible");

    // Tasks grid present, check task title appears somewhere
    cy.contains("First task").should("be.visible");
  });

  it("shows toasts when endpoints fail", () => {
    cy.intercept("GET", "/api/tasks/statistics", {
      statusCode: 500,
      body: { detail: "Failed to fetch statistics" },
    }).as("statsFail");

    cy.intercept("GET", "/api/auth/users", {
      statusCode: 500,
      body: { detail: "Failed to fetch users" },
    }).as("usersFail");

    // Match task list endpoint but EXCLUDE /tasks/statistics (error path)
    cy.intercept(
      { method: "GET", url: /^^\/api\/tasks\/(?!statistics)(.*)$/ },
      {
        statusCode: 500,
        body: { detail: "Failed to fetch tasks" },
      }
    ).as("tasksFail");

    cy.intercept("GET", "/api/auth/me", {
      statusCode: 500,
      body: { detail: "Failed to fetch auth user" },
    }).as("meFail");

    // Force missing auth.id to ensure the component triggers the auth fetch branch that will fail
    mountWithStore({ auth: undefined as any });

    cy.wait(["@statsFail", "@usersFail", "@tasksFail", "@meFail"]);

    // Expect multiple error toasts
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    // Specifically verify the auth error toast is shown to cover the error branch
    cy.get("[data-sonner-toast]")
      .contains("Failed to fetch auth user")
      .should("exist");
  });
});
