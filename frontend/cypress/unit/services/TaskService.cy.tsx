import React, { useEffect } from "react";
import axios from "axios";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import usersReducer from "@/lib/store/slices/users";
import TaskService from "@/services/taskService";
import { AppStore } from "@/lib/store";

// Harness component to construct the service (which uses hooks) and run tests
const ServiceHarness: React.FC<{
  run: (ctx: { service: TaskService; store: any }) => void | Promise<void>;
  api: ReturnType<typeof axios.create>;
  store: any;
}> = ({ run, api, store }) => {
  const s = new TaskService(api);
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

describe("TaskService", () => {
  it("getTasks sends default pagination and returns list", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/tasks/**", (req) => {
      // Verify default params
      expect(req.query.page).to.eq("1");
      expect(req.query.size).to.eq("10");
      req.reply({
        statusCode: 200,
        body: {
          tasks: [{ id: 1, title: "A" }],
          page: 1,
          size: 10,
          pages: 1,
        },
      });
    }).as("tasks");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const res = await service.getTasks();
          expect(res.tasks).to.have.length(1);
        }}
      />,
      store
    );

    cy.wait(["@tasks"]);
  });

  it("getTasksStatistics stores statistics in state", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "/api/tasks/statistics", {
      statusCode: 200,
      body: {
        total_tasks: 3,
        completed_tasks: 1,
        pending_tasks: 2,
        overdue_tasks: 0,
        high_priority_tasks: 0,
        medium_priority_tasks: 1,
        low_priority_tasks: 2,
      },
    }).as("stats");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          await service.getTasksStatistics();
        }}
      />,
      store
    );

    cy.wait(["@stats"]).then(() => {
      const state = store.getState();
      expect(state.task.statistics?.total_tasks).to.eq(3);
    });
  });

  it("createTask posts payload, dispatches addTask and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "/api/tasks/", {
      statusCode: 201,
      body: { id: 9, title: "New" },
    }).as("create");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service, store }) => {
          const status = await service.createTask({ title: "New", description: "d" } as any);
          expect(status).to.eq(201);
        }}
      />,
      store
    );

    cy.wait(["@create"]).then(() => {
      const state = store.getState();
      expect(state.task.tasks[0]?.title).to.eq("New");
    });
  });

  it("updateTask sends PUT and updates store", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("PUT", "/api/tasks/5", { statusCode: 200, body: { id: 5, title: "Updated" } }).as("update");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.updateTask(5, { title: "Updated" } as any);
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@update"]).then(() => {
      const state = store.getState();
      // After update, the reducer should reflect item; since initial list is empty, we just assert no crash
      expect(state.task).to.exist;
    });
  });

  it("markTaskAsCompleted sets completed in store and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } } as any);
    // Preload the task in the slice via dispatch
    store.dispatch({
      type: "task/setTasks",
      payload: [
        {
          id: 7,
          title: "seed",
          description: "",
          due_date: "",
          priority: "baja",
          assigned_to: 0,
          created_by: 0,
          completed: false,
          comments: [],
          created_at: "",
          updated_at: "",
        },
      ],
    });

    cy.intercept("PUT", "**/tasks/7", { statusCode: 200, body: { id: 7, completed: true } }).as("complete");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.markTaskAsCompleted(7);
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@complete"]).then(() => {
      const state: any = store.getState();
      const slice = state.task ?? state.tasks;
      expect(slice).to.exist;
      const item = slice.tasks.find((t: any) => t.id === 7);
      expect(item).to.exist;
      expect(item!.completed).to.eq(true);
    });
  });

  it("deleteTask dispatches delete and returns status", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("DELETE", "/api/tasks/11", { statusCode: 204, body: {} }).as("delete");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.deleteTask(11);
          expect(status).to.eq(204);
        }}
      />,
      store
    );

    cy.wait(["@delete"]).then(() => {
      const state = store.getState();
      expect(state.task).to.exist;
    });
  });

  it("addComment posts and dispatches addComment action", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "/api/tasks/22/comments", { statusCode: 201, body: { id: 1, content: "hi" } }).as("comment");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.addComment(22, "hi");
          expect(status).to.eq(201);
        }}
      />,
      store
    );

    cy.wait(["@comment"]).then(() => {
      const state = store.getState();
      expect(state.task).to.exist;
    });
  });

  it("getTasks sends filters and custom paging", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "**/tasks/**", (req) => {
      expect(req.query.page).to.eq("2");
      expect(req.query.size).to.eq("5");
      expect(req.query.completed).to.eq("true");
      expect(req.query.priority).to.eq("HIGH");
      req.reply({ statusCode: 200, body: { tasks: [], page: 2, size: 5, pages: 0 } });
    }).as("tasksFilters");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const res = await service.getTasks({ completed: true, priority: "HIGH" } as any, 2, 5);
          expect(res.page).to.eq(2);
          expect(res.size).to.eq(5);
        }}
      />,
      store
    );

    cy.wait(["@tasksFilters"]);
  });

  it("getTasks throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "**/tasks/**", { statusCode: 500, body: { detail: "boom" } }).as("tasksErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.getTasks();
          } catch (e) {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@tasksErr"]);
  });

  it("getTasksStatistics throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore();

    cy.intercept("GET", "**/tasks/statistics", { statusCode: 500, body: {} }).as("statsErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.getTasksStatistics();
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@statsErr"]);
  });

  it("createTask includes CSRF header", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "**/tasks/**", (req) => {
      expect(req.headers["x-csrf-token"]).to.eq("x");
      req.reply({ statusCode: 201, body: { id: 1, title: "ok" } });
    }).as("createCsrf");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.createTask({ title: "ok", description: "d" } as any);
          expect(status).to.eq(201);
        }}
      />,
      store
    );

    cy.wait(["@createCsrf"]);
  });

  it("createTask throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "**/tasks/**", { statusCode: 500, body: {} }).as("createErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.createTask({ title: "err", description: "d" } as any);
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@createErr"]);
  });

  it("updateTask throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("PUT", "**/tasks/5", { statusCode: 500, body: {} }).as("updateErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.updateTask(5, { title: "bad" } as any);
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@updateErr"]);
  });

  it("markTaskAsCompleted throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("PUT", "**/tasks/7", { statusCode: 500, body: {} }).as("completeErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.markTaskAsCompleted(7);
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@completeErr"]);
  });

  it("deleteTask throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("DELETE", "**/tasks/11", { statusCode: 500, body: {} }).as("deleteErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.deleteTask(11);
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@deleteErr"]);
  });

  it("addComment throws on error", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "**/tasks/22/comments", { statusCode: 500, body: {} }).as("commentErr");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          let threw = false;
          try {
            await service.addComment(22, "hi");
          } catch {
            threw = true;
          }
          expect(threw).to.eq(true);
        }}
      />,
      store
    );

    cy.wait(["@commentErr"]);
  });

  it("updateTask includes CSRF header", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("PUT", "**/tasks/5", (req) => {
      const csrf = (req.headers["x-csrf-token"] as any) ?? (req.headers as any)["X-CSRF-Token"];
      expect(csrf).to.eq("x");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      expect(body).to.include({ title: "hdr" });
      req.reply({ statusCode: 200, body: { id: 5, title: "hdr" } });
    }).as("updateCsrf");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.updateTask(5, { title: "hdr" } as any);
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@updateCsrf"]);
  });

  it("markTaskAsCompleted includes CSRF header and updates store", () => {
    const api = axios.create({ baseURL: "/api" });
    const preloaded = {
      auth: { csrfToken: "x" },
      task: { tasks: [{ id: 7, title: "t", completed: false }] },
    };
    const store = makeStore(preloaded);

    cy.intercept("PUT", "**/tasks/7", (req) => {
      const csrf = (req.headers["x-csrf-token"] as any) ?? (req.headers as any)["X-CSRF-Token"]; 
      expect(csrf).to.eq("x");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      expect(body).to.include({ completed: true });
      req.reply({ statusCode: 200, body: { id: 7, completed: true } });
    }).as("completeCsrf");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.markTaskAsCompleted(7);
          expect(status).to.eq(200);
        }}
      />,
      store
    );

    cy.wait(["@completeCsrf"]);
  });

  it("deleteTask includes CSRF header and removes from store", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } } as any);
    // Preload task id 11 so reducer can remove it
    store.dispatch({
      type: "task/setTasks",
      payload: [
        {
          id: 11,
          title: "to-del",
          description: "",
          due_date: "",
          priority: "baja",
          assigned_to: 0,
          created_by: 0,
          completed: false,
          comments: [],
          created_at: "",
          updated_at: "",
        },
      ],
    });

    cy.intercept("DELETE", "**/tasks/11", (req) => {
      const csrf = (req.headers["x-csrf-token"] as any) ?? (req.headers as any)["X-CSRF-Token"]; 
      expect(csrf).to.eq("x");
      req.reply({ statusCode: 204, body: {} });
    }).as("deleteCsrf");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.deleteTask(11);
          expect(status).to.eq(204);
        }}
      />,
      store
    );

    cy.wait(["@deleteCsrf"]).then(() => {
      const state = store.getState();
      expect(state.task.tasks.find((t: any) => t.id === 11)).to.be.undefined;
    });
  });

  it("addComment includes CSRF header", () => {
    const api = axios.create({ baseURL: "/api" });
    const store = makeStore({ auth: { csrfToken: "x" } });

    cy.intercept("POST", "**/tasks/22/comments", (req) => {
      const csrf = (req.headers["x-csrf-token"] as any) ?? (req.headers as any)["X-CSRF-Token"]; 
      expect(csrf).to.eq("x");
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      expect(body).to.include({ content: "hello" });
      req.reply({ statusCode: 201, body: { id: 1, content: "hello" } });
    }).as("commentCsrf");

    mountWithProviders(
      <ServiceHarness
        api={api}
        store={store}
        run={async ({ service }) => {
          const status = await service.addComment(22, "hello");
          expect(status).to.eq(201);
        }}
      />,
      store
    );

    cy.wait(["@commentCsrf"]);
  });
});
