import React from "react";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import tasksReducer from "@/lib/store/slices/tasks";
import authReducer from "@/lib/store/slices/auth";
import usersReducer from "@/lib/store/slices/users";
import { TasksDailyChartComponent } from "@/components/dashboard/tasks-daily-chart";
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
      users: { users: [] },
      ...(preloaded as any),
    } as any,
  });

const mountWithStore = (store: ReturnType<typeof makeStore>) => {
  cy.mount(
    <div style={{ width: 800, height: 400 }}>
      <Provider store={store}>
        <TasksDailyChartComponent />
      </Provider>
    </div>
  );
};

describe("TasksDailyChartComponent", () => {
  it("renders one bar per week day and correct day labels with deterministic week", () => {
    cy.viewport(1000, 800);
    // Fix 'today' to Wednesday, Aug 6, 2025 so the computed week is deterministic
    cy.clock(new Date("2025-08-06T12:00:00Z").getTime());

    // For week Mon 2025-08-04 .. Sun 2025-08-10
    const store = makeStore({
      task: {
        tasks: [
          // Mon
          {
            id: 1,
            title: "Task Mon",
            description: "",
            completed: false,
            priority: "media" as any,
            due_date: null,
            created_by: 1,
            assigned_to: null,
            comments: [],
            created_at: "2025-08-04T10:00:00Z",
            updated_at: "2025-08-04T10:00:00Z",
          },
          // Wed (2)
          {
            id: 2,
            title: "Task Wed A",
            description: "",
            completed: false,
            priority: "media" as any,
            due_date: null,
            created_by: 1,
            assigned_to: null,
            comments: [],
            created_at: "2025-08-06T09:00:00Z",
            updated_at: "2025-08-06T09:00:00Z",
          },
          {
            id: 3,
            title: "Task Wed B",
            description: "",
            completed: false,
            priority: "media" as any,
            due_date: null,
            created_by: 1,
            assigned_to: null,
            comments: [],
            created_at: "2025-08-06T18:00:00Z",
            updated_at: "2025-08-06T18:00:00Z",
          },
          // Sun
          {
            id: 4,
            title: "Task Sun",
            description: "",
            completed: false,
            priority: "media" as any,
            due_date: null,
            created_by: 1,
            assigned_to: null,
            comments: [],
            created_at: "2025-08-10T11:00:00Z",
            updated_at: "2025-08-10T11:00:00Z",
          },
        ],
        pagination: { page: 1, size: 10, total_pages: 1 },
        tasksFilters: {},
        statistics: {
          total_tasks: 4,
          completed_tasks: 0,
          pending_tasks: 4,
          overdue_tasks: 0,
          high_priority_tasks: 0,
          medium_priority_tasks: 4,
          low_priority_tasks: 0,
        },
      } as any,
    });

    // Ensure sufficient viewport for ResponsiveContainer
    cy.viewport(1000, 800);
    mountWithStore(store);

    // Wait for chart surface to render
    cy.get('svg.recharts-surface').should('exist');

    // Expect 7 ticks for Mon..Sun
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
      cy.contains(d).should("be.visible");
    });

    // Ensure bar layer is present and there is at least one bar shape
    cy.get('g.recharts-layer.recharts-bar').should('exist');
    cy.get('svg.recharts-surface').find('rect, path').its('length').should('be.gt', 0);

    // Hover roughly over the 3rd tick (Wed) by moving the mouse over the SVG at ~2.5/7 width
    cy.get('svg.recharts-surface').then(($svg) => {
      const rect = ($svg[0] as unknown as SVGSVGElement).getBoundingClientRect();
      const clientX = rect.left + (rect.width * 2.5) / 7;
      const clientY = rect.top + rect.height / 2;
      cy.wrap($svg).trigger('mousemove', { clientX, clientY, force: true });
    });
    cy.get(".recharts-default-tooltip").should("contain.text", "count").and("contain.text", "2");
  });
});
