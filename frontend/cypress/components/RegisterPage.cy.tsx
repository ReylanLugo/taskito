import React from "react";
import "@/app/globals.css";
import RegisterPage from "@/app/register/page";
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
        <RegisterPage />
      </AppRouterContext.Provider>
    </Provider>
  );
};

const fillFieldByLabel = (labelText: string, value: string) => {
  cy.contains("label", labelText).parent().find("input").clear().type(value);
};

describe("RegisterPage", () => {
  beforeEach(() => {
    cy.viewport(1000, 900);
  });

  it("registers successfully and redirects to /dashboard", () => {
    // Intercepts for register + auto login + me
    cy.intercept("POST", "/api/auth/register", {
      statusCode: 201,
      body: { detail: "Created" },
    }).as("register");
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 200,
      body: { access_token: "test-token", token_type: "bearer" },
    }).as("login");
    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: 1,
          username: "newuser",
          email: "newuser@example.com",
          role: "user",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      },
    }).as("me");

    mountWithStore();

    fillFieldByLabel("Name", "newuser");
    fillFieldByLabel("Email", "newuser@example.com");
    // Password and confirm password
    fillFieldByLabel("Password", "Password123");
    fillFieldByLabel("Confirm Password", "Password123");

    cy.contains("button", /^Register$/).click();

    cy.wait(["@register", "@login", "@me"]);

    cy.get("@routerPush").should("have.been.calledWith", "/dashboard");
    // Success toast
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Registration successful!/i, { matchCase: false })
      .should("exist");
  });

  it("shows validation error when passwords do not match and prevents navigation", () => {
    mountWithStore();

    fillFieldByLabel("Name", "newuser");
    fillFieldByLabel("Email", "newuser@example.com");
    fillFieldByLabel("Password", "Password123");
    fillFieldByLabel("Confirm Password", "Different123");

    cy.contains("button", /^Register$/).click();

    // A general invalid input toast is shown by the component's error handler
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Invalid input/i, { matchCase: false })
      .should("exist");

    cy.get("@routerPush").should("not.have.been.called");
  });

  it("shows error toast when backend returns an error (e.g., username exists)", () => {
    cy.intercept("POST", "/api/auth/register", {
      statusCode: 400,
      body: { detail: "Username already exists" },
    }).as("registerFail");

    mountWithStore();

    fillFieldByLabel("Name", "existing");
    fillFieldByLabel("Email", "existing@example.com");
    fillFieldByLabel("Password", "Password123");
    fillFieldByLabel("Confirm Password", "Password123");

    cy.contains("button", /^Register$/).click();

    cy.wait("@registerFail");

    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("[data-sonner-toast]")
      .contains(/Username already exists/i, { matchCase: false })
      .should("exist");
    cy.get("@routerPush").should("not.have.been.called");
  });
});
