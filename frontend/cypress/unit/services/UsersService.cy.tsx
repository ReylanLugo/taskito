import React, { useEffect } from "react";
import axios from "axios";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import usersReducer from "@/lib/store/slices/users";
import UsersService from "@/services/usersService";
import { AppStore } from "@/lib/store";

// Harness to instantiate service (uses hooks) inside React
const ServiceHarness: React.FC<{
  run: (ctx: { service: UsersService; store: AppStore }) => void | Promise<void>;
  api: ReturnType<typeof axios.create>;
  store: AppStore;
}> = ({ run, api, store }) => {
  const s = new UsersService(api);
  useEffect(() => {
    Promise.resolve(run({ service: s, store })).catch(() => {});
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
      {ui}
    </Provider>
  );
};

describe("UsersService", () => {
  it("getUsers stores users and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/auth/users", {
      statusCode: 200,
      body: {
        users: [
          { id: 1, username: "alice", email: "a@a.com" },
          { id: 2, username: "bob", email: "b@b.com" },
        ],
      },
    }).as("users");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.getUsers();
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@users"]).then(() => {
      const state = store.getState();
      expect(state.users.users).to.have.length(2);
    });
  });

  it("getUsers failure bubbles error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/auth/users", { statusCode: 500, body: { detail: "boom" } }).as("usersFail");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let caught = false;
          try {
            await service.getUsers();
          } catch (e) {
            caught = true;
          }
          expect(caught).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@usersFail"]);
  });
});
