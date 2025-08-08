import React from "react";
import "@/app/globals.css";
import ErrorPage from "@/app/error";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Toaster } from "@/components/ui/sonner";

// Minimal test store for component mounting (reuse pattern to avoid App Router issues)
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
        <ErrorPage />
      </AppRouterContext.Provider>
    </Provider>
  );
};

describe("ErrorPage", () => {
  beforeEach(() => {
    cy.viewport(800, 600);
  });

  it("renders logo, heading and try again button", () => {
    mountWithStore();

    // Heading text
    cy.contains("Something went wrong!").should("be.visible");

    // Button
    cy.contains("button", "Try again").should("be.visible");

    // Image by alt text
    cy.get("img[alt='Error']").should("be.visible");
  });

  it("calls onRetry when clicking 'Try again' (no real reload)", () => {
    const onRetry = cy.stub().as("onRetry");

    // Remount with onRetry prop
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
          <ErrorPage onRetry={onRetry} />
        </AppRouterContext.Provider>
      </Provider>
    );

    cy.contains("button", "Try again").click();
    cy.get("@onRetry").should("have.been.calledOnce");
  });
});
