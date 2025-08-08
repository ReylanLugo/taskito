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

  it("getUsersTasks returns tasks for a user", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/users/1/tasks", {
      statusCode: 200,
      body: [
        { id: 10, title: "T1" },
        { id: 11, title: "T2" },
      ],
    }).as("userTasks");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const tasks = await service.getUsersTasks(1);
          expect(tasks).to.have.length(2);
          expect(tasks[0].id).to.eq(10);
        }}
      />,
      store
    );

    cy.wait(["@userTasks"]);
  });

  it("deleteUser sends CSRF header, updates store and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const preloaded = {
      auth: { csrfToken: "csrf-123" },
      users: { users: [
        { id: 1, username: "alice", email: "a@a.com" },
        { id: 2, username: "bob", email: "b@b.com" },
      ] },
    };
    const store = makeStore(preloaded);

    cy.intercept("DELETE", "/api/users/2", (req) => {
      // Assert CSRF header present
      expect(req.headers["x-csrf-token"]).to.eq("csrf-123");
      req.reply({ statusCode: 204, body: {} });
    }).as("delUser");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.deleteUser(2);
          expect(status).to.eq(204);
        }}
      />,
      store
    );

    cy.wait(["@delUser"]).then(() => {
      const state = store.getState();
      expect(state.users.users.find((u: any) => u.id === 2)).to.be.undefined;
      expect(state.users.users).to.have.length(1);
    });
  });

  it("deleteUser failure bubbles error", () => {
    const api = axios.create({ baseURL: "/api" });
    const preloaded = { auth: { csrfToken: "csrf-123" }, users: { users: [{ id: 1, username: "alice", email: "a@a.com" }] } };
    const store = makeStore(preloaded);

    cy.intercept("DELETE", "/api/users/1", { statusCode: 500, body: { detail: "fail" } }).as("delUserFail");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let caught = false;
          try {
            await service.deleteUser(1);
          } catch (e) {
            caught = true;
          }
          expect(caught).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@delUserFail"]);
  });

  it("updateUser sends CSRF header, updates store and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const preloaded = {
      auth: { csrfToken: "csrf-123" },
      users: { users: [
        { id: 1, username: "alice", email: "a@a.com" },
        { id: 2, username: "bob", email: "b@b.com" },
      ] },
    };
    const store = makeStore(preloaded);

    const update = { username: "alice2", email: "alice2@a.com" };

    cy.intercept("PUT", "/api/users/1", (req) => {
      // Assert CSRF header present
      expect(req.headers["x-csrf-token"]).to.eq("csrf-123");
      // Assert body contains our update
      expect(req.body).to.include(update);
      req.reply({ statusCode: 200, body: { id: 1, ...update } });
    }).as("updUser");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.updateUser(1, update as any);
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@updUser"]).then(() => {
      const state = store.getState();
      const u = state.users.users.find((u: any) => u.id === 1)!;
      expect(u).to.not.be.undefined;
      expect(u.username).to.eq("alice2");
      expect(u.email).to.eq("alice2@a.com");
    });
  });

  it("updateUser failure bubbles error", () => {
    const api = axios.create({ baseURL: "/api" });
    const preloaded = { auth: { csrfToken: "csrf-123" }, users: { users: [{ id: 1, username: "alice", email: "a@a.com" }] } };
    const store = makeStore(preloaded);

    cy.intercept("PUT", "/api/users/1", { statusCode: 500, body: { detail: "nope" } }).as("updUserFail");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let caught = false;
          try {
            await service.updateUser(1, { username: "x", email: "y@y.com" } as any);
          } catch (e) {
            caught = true;
          }
          expect(caught).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@updUserFail"]);
  });
});
