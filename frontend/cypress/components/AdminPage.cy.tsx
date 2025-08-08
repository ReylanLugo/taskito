import React from "react";
import "@/app/globals.css";
import AdminPage from "@/app/dashboard/admin/page";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import { Toaster } from "@/components/ui/sonner";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Root reducer for testing
const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

const makeStore = (preloadedState?: any) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

const mountWithStore = (preloadedState?: any) => {
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
        <AdminPage />
      </AppRouterContext.Provider>
    </Provider>
  );
};

describe("AdminPage", () => {
  beforeEach(() => {
    cy.viewport(1200, 900);
  });

  it("renders admin UI and navigates to /dashboard when clicking Dashboard button", () => {
    // Preload store with an admin user and one listed user so the page can compute stats
    const preloadedState = {
      auth: {
        access_token: "token",
        token_type: "bearer",
        id: 999,
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      users: {
        users: [
          {
            id: 1,
            username: "alice",
            email: "alice@example.com",
            role: "user",
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      },
    } as any;

    // Intercepts for effects used by AdminPage
    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: 999,
          username: "admin",
          email: "admin@example.com",
          role: "admin",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    }).as("me");

    // The page calls getUsers(); backend path is namespaced under /api/auth
    cy.intercept("GET", "/api/auth/users", {
      statusCode: 200,
      body: preloadedState.users.users,
    }).as("users");

    // For each user in store, the page requests tasks (match both with/without /auth prefix)
    cy.intercept("GET", "**/users/1/tasks", {
      statusCode: 200,
      body: [
        {
          id: 10,
          title: "Task A",
          description: "desc",
          completed: false,
          created_by: 999,
          assigned_to: 1,
          priority: "medium",
          due_date: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    }).as("tasksAlice");

    mountWithStore(preloadedState);

    // Click Dashboard button
    cy.contains("button", /^Dashboard$/).click();
    cy.get("@routerPush")
      .should("have.been.called")
      .then((stub: any) => {
        const calls = stub.getCalls().map((c: any) => c.args?.[0]);
        expect(calls).to.include("/dashboard");
      });

    // Wait for effects to complete
    cy.wait(["@me", "@users", "@tasksAlice"]);
  });

  it("shows Unauthorized when role is not admin", () => {
    const preloadedState = {
      auth: {
        access_token: "token",
        token_type: "bearer",
        id: 2,
        username: "bob",
        email: "bob@example.com",
        role: "user",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      users: { users: [] },
    } as any;

    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: 2,
          username: "bob",
          email: "bob@example.com",
          role: "user",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    }).as("me");

    mountWithStore(preloadedState);

    cy.contains(/Unauthorized/i).should("be.visible");
    cy.get("@routerPush").should("not.have.been.called");
  });
});
