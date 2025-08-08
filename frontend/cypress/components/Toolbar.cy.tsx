import React from "react";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import Toolbar from "@/components/dashboard/TasksGrid/toolbar";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

const rootReducer = combineReducers({
  auth: authReducer,
  task: tasksReducer,
  users: usersReducer,
});

type RootState = ReturnType<typeof rootReducer>;

const makeStore = (preloaded?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      auth: {
        id: 1,
        username: "tester",
        email: "tester@example.com",
        role: "admin",
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
            username: "alice",
            email: "alice@example.com",
            role: "user",
            is_active: true,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
          {
            id: 2,
            username: "bob",
            email: "bob@example.com",
            role: "user",
            is_active: true,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
      },
      ...(preloaded as any),
    } as any,
  });

const mountWithStore = (store: ReturnType<typeof makeStore>) => {
  cy.mount(
    <Provider store={store}>
      <Toaster />
      <Toolbar />
    </Provider>
  );
};

describe("Toolbar Component", () => {
  it("renders basic controls", () => {
    cy.viewport(1000, 800);
    const store = makeStore();
    mountWithStore(store);

    cy.get('[data-testid="task-toolbar"]').should("exist");
    cy.get('[data-testid="search-input"]').should("exist");
    cy.get('[data-testid="completion-filter"]').should("exist");
    cy.get('[data-testid="priority-filter"]').should("exist");
    cy.get('[data-testid="apply-filters"]').should("exist");
  });

  it("applies basic filters and calls API with expected params", () => {
    cy.viewport(1000, 800);
    // Capture the requested URL to assert query params
    let requestedUrl = "";
    cy.intercept({ method: "GET", url: /\/api\/tasks\/?(\?.*)?$/ }, (req) => {
      requestedUrl = req.url;
      req.reply({
        statusCode: 200,
        body: {
          tasks: [],
          page: 1,
          size: 10,
          pages: 1,
        },
      });
    }).as("getTasks");

    const store = makeStore();
    mountWithStore(store);

    // Search text
    cy.get('[data-testid="search-input"]').type("urgent bug");

    // Completed: select Completed
    cy.get('[data-testid="completion-filter"]').click();
    cy.get('[role="option"]').contains(/^Completed$/).click({ force: true });

    // Priority: select High
    cy.get('[data-testid="priority-filter"]').click();
    cy.get('[role="option"]').contains(/^High$/).click({ force: true });

    // Apply
    cy.get('[data-testid="apply-filters"]').click();

    cy.wait("@getTasks", { timeout: 15000 }).then(() => {
      // Assert expected params present in URL
      expect(requestedUrl).to.match(/search=urgent(\+|%20)bug/);
      // completed true
      expect(requestedUrl).to.match(/completed=(true|1)/);
      // priority high (enum mapping may be string or number)
      expect(requestedUrl).to.match(/priority=(HIGH|alta|3|2)/);
      // page & size from toolbar call
      expect(requestedUrl).to.contain("page=1");
      expect(requestedUrl).to.contain("size=10");
    });
  });

  it("opens More Filters dialog and allows selecting extra filters", () => {
    cy.viewport(1000, 800);
    cy.intercept({ method: "GET", url: /\/api\/tasks\/?(\?.*)?$/ }, { statusCode: 200, body: { tasks: [], page: 1, size: 10, pages: 1 } }).as("getTasks2");

    const store = makeStore();
    mountWithStore(store);

    // Open More Filters dialog by clicking the button with test id
    cy.get('[data-testid="open-more-filters"]').click({ force: true });
    cy.contains(/More Filters/i).should('exist');

    // Assigned To combobox: open and select alice
    cy.contains("label", /Assigned To/i).parent().within(() => {
      cy.get("button, input").first().click({ force: true });
    });
    cy.contains(/^alice$/i).click({ force: true });

    // Created By combobox: open and select bob
    cy.contains("label", /Created By/i).parent().within(() => {
      cy.get("button, input").first().click({ force: true });
    });
    cy.contains(/^bob$/i).click({ force: true });

    // Close the dialog(s) using ESC to ensure all overlays are dismissed
    cy.get('body').type('{esc}{esc}');
    cy.contains(/More Filters/i).should('not.exist');
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('body').should('not.have.attr', 'data-scroll-locked');

    // Submit to ensure no errors
    cy.get('[data-testid="apply-filters"]').click();

    cy.wait("@getTasks2", { timeout: 15000 });
  });
});
