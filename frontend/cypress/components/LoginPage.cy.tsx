import React from "react";
import "@/app/globals.css";
import LoginPage from "@/app/page";
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

const makeStore = () =>
  configureStore({
    reducer: rootReducer,
  });

const mountWithStore = () => {
  const store = makeStore();
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
        <LoginPage />
      </AppRouterContext.Provider>
    </Provider>
  );
};

describe("LoginPage", () => {
  beforeEach(() => {
    cy.viewport(1000, 800);
  });

  it("logs in successfully and redirects to /dashboard", () => {
    // Intercepts for auth flows
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 200,
      body: { access_token: "test-token", token_type: "bearer" },
    }).as("login");
    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: 1,
          username: "tester",
          email: "tester@example.com",
          role: "user",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    }).as("me");

    mountWithStore();

    cy.get("#username").type("alice");
    cy.get("#password").type("Password123123");
    cy.contains("button", /^Login$/).click();

    cy.wait(["@login", "@me"]);

    cy.get("@routerPush").should("have.been.calledWith", "/dashboard");
    // Success toast
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Login successful!/i, { matchCase: false })
      .should("exist");
  });

  it("shows validation error for short password (min 8 chars)", () => {
    mountWithStore();

    // Valid username, invalid short password
    cy.get("#username").type("alice");
    cy.get("#password").type("short"); // 5 chars
    cy.contains("button", /^Login$/).click();

    // Zod/RHF should block submit and show field error
    cy.contains("Password must be at least 8 characters long").should(
      "be.visible"
    );

    // No navigation or toast should occur
    cy.get("@routerPush").should("not.have.been.called");
    cy.get("[data-sonner-toast]").should("not.exist");
  });

  it("shows error toast when credentials are invalid", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 401,
      body: { detail: "Invalid credentials" },
    }).as("loginFail");

    mountWithStore();

    cy.get("#username").type("alice");
    cy.get("#password").type("Awrong13123132");
    cy.contains("button", /^Login$/).click();

    cy.wait("@loginFail");

    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Invalid credentials/i, { matchCase: false })
      .should("exist");
    cy.get("@routerPush").should("not.have.been.called");
  });
});
