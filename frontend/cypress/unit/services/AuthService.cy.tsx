import React, { useEffect } from "react";
import axios from "axios";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer, { setUser } from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import usersReducer from "@/lib/store/slices/users";
import { Toaster } from "@/components/ui/sonner";
import AuthService from "@/services/authService";
import { AppStore } from "@/lib/store";

// Harness component to safely use hooks inside services
const ServiceHarness: React.FC<{
  run: (ctx: { service: AuthService; store: AppStore }) => void | Promise<void>;
  api: ReturnType<typeof axios.create>;
  store: AppStore;
}> = ({ run, api, store }) => {
  // Instantiate during render so hooks inside service constructor run in render phase
  const s = new AuthService(api);
  useEffect(() => {
    Promise.resolve(run({ service: s, store })).catch(() => {});
    // run only once for this instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const rootReducer = combineReducers({ auth: authReducer, task: tasksReducer, users: usersReducer });

const makeStore = (preloadedState?: any) =>
  configureStore({ reducer: rootReducer, preloadedState });

const mountWithProviders = (ui: React.ReactNode, store: AppStore) => {
  cy.mount(
    <Provider store={store}>
      <Toaster />
      {ui}
    </Provider>
  );
};

describe("AuthService", () => {
  it("login success sets user via /auth/me", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("POST", "/api/auth/login", {
      statusCode: 200,
      body: { access_token: "token", token_type: "bearer" },
    }).as("login");

    cy.intercept("GET", "/api/auth/me", {
      statusCode: 200,
      body: { user: { id: 1, username: "john" } },
    }).as("me");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service, store }) => {
          const res: any = await service.login({ username: "john", password: "doe" });
          expect(res).to.have.property("access_token", "token");
        }}
      />,
      store
    );

    cy.wait(["@login", "@me"]).then(() => {
      const state = store.getState();
      expect(state.auth.username).to.eq("john");
    });
  });

  it("login error shows toast", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("POST", "/api/auth/login", {
      statusCode: 401,
      body: { detail: "Invalid credentials" },
    }).as("loginFail");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          await service.login({ username: "bad", password: "bad" });
        }}
      />,
      store
    );

    cy.wait(["@loginFail"]).then(() => {
      cy.get("[data-sonner-toast]").contains("Invalid credentials").should("exist");
    });
  });

  it("getUser success stores user", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/auth/me", { statusCode: 200, body: { user: { id: 2, username: "alice" } } }).as("me");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const u = await service.getUser();
          expect(u?.username).to.eq("alice");
        }}
      />,
      store
    );

    cy.wait(["@me"]).then(() => {
      const state = store.getState();
      expect(state.auth.username).to.eq("alice");
    });
  });

  it("register success chains login and me", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("POST", "/api/auth/register", { statusCode: 201, body: {} }).as("register");
    cy.intercept("POST", "/api/auth/login", { statusCode: 200, body: { access_token: "t" } }).as("login");
    cy.intercept("GET", "/api/auth/me", { statusCode: 200, body: { user: { id: 3, username: "neo" } } }).as("me");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.register({ username: "neo", password: "Matrix123", email: "neo@ex.com", role: "user" } as any);
          expect(status).to.eq(201);
        }}
      />,
      store
    );

    cy.wait(["@register", "@login", "@me"]).then(() => {
      const state = store.getState();
      expect(state.auth.username).to.eq("neo");
    });
  });
});
