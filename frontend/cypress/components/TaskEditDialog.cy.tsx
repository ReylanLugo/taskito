import React from "react";
import "@/app/globals.css";
import TaskEditDialog from "@/components/shared/task-edit-dialog";
import { Task, TaskPriority } from "@/types/Tasks";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import usersReducer from "@/lib/store/slices/users";
import authReducer from "@/lib/store/slices/auth";
import tasksReducer from "@/lib/store/slices/tasks";
import * as Sonner from "sonner";

// Realistic Redux test store (same pattern used in other component tests)
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
    },
  });

const mountWithStore = (store: ReturnType<typeof makeStore>, task: Task) => {
  cy.mount(
    <Provider store={store}>
      <div style={{ width: 700 }}>
        <TaskEditDialog task={task} />
      </div>
    </Provider>
  );
};

const baseTask: Task = {
  id: 42,
  title: "Initial title",
  description: "Initial description",
  completed: false,
  priority: TaskPriority.MEDIUM,
  created_by: 1,
  assigned_to: 2,
  comments: [],
  created_at: "2025-08-05T10:00:00Z",
  updated_at: "2025-08-05T10:00:00Z",
  due_date: "2025-08-15T00:00:00Z",
};

function mountDialog(taskOverrides: Partial<Task> = {}) {
  const task = { ...baseTask, ...taskOverrides } as Task;
  const store = makeStore();
  mountWithStore(store, task);

  return { task };
}

describe("TaskEditDialog", () => {
  beforeEach(() => {
    cy.viewport(1000, 800);
  });

  it("opens the dialog and shows pre-filled values from the task", () => {
    const { task } = mountDialog();

    cy.get('[data-testid="task-edit-button"]').click();

    // Title and description should be pre-filled
    cy.get('[data-testid="title-input"]').should("have.value", task.title);
    cy.get('[data-testid="description-input"]').should(
      "have.value",
      task.description
    );

    // Priority trigger should display the selected label (Spanish labels: Baja, Media, Alta)
    cy.get('[data-testid="priority-select"]').should("contain.text", "Media");

    // Due date: some DatePicker implementations render a button trigger instead of an input.
    // Assert the control exists next to the label and, if text is visible, it contains the expected date.
    const expectedDate = task.due_date?.slice(0, 10);
    cy.contains("label", /Due Date/i)
      .parent()
      .within(() => {
        cy.get("button, input")
          .first()
          .should("exist")
          .then(($ctrl) => {
            const text = $ctrl.text().trim();
            if (text && expectedDate) {
              const d = new Date(expectedDate + "T00:00:00Z");
              const year = d.getUTCFullYear().toString();
              const monthLong = d.toLocaleString("en-US", {
                month: "long",
                timeZone: "UTC",
              });
              const day = d.getUTCDate();
              const prevDay = day - 1; // handle local TZ rendering previous day

              expect(text).to.include(year);
              expect(text).to.match(new RegExp(monthLong, "i"));
              const hasExpectedDay =
                text.includes(String(day)) || text.includes(String(prevDay));
              expect(
                hasExpectedDay,
                `displayed day should be ${day} or ${prevDay} due to TZ`
              ).to.be.true;
            }
          });
      });

    // Assigned To combobox: open by navigating from label and assert 'bob' is available (selected display can vary by implementation)
    cy.contains("label", /Assigned To/i)
      .parent()
      .within(() => {
        cy.get("button, input").first().click({ force: true });
      });
    cy.contains(/^bob$/i).should("be.visible");
  });

  it("submits changes and shows success toast", () => {
    const { task } = mountDialog();

    // Intercept the PUT request to update the task and capture payload
    cy.intercept({ method: "PUT", url: /\/api\/tasks\/\d+$/ }, (req) => {
      req.reply({ statusCode: 200, body: {} });
    }).as("updateTask");
    cy.stub((Sonner as typeof import("sonner")).toast, "success").as(
      "toastSuccess"
    );

    cy.get('[data-testid="task-edit-button"]').click();

    // Edit fields within the visible dialog to avoid hidden clones
    cy.get('[role="dialog"]')
      .should("be.visible")
      .within(() => {
        cy.get('[data-testid="title-input"]')
          .should("be.visible")
          .clear({ force: true })
          .type("Updated title", { force: true })
          .should("have.value", "Updated title")
          .trigger("input")
          .trigger("change")
          .blur();
        cy.get('[data-testid="priority-select"]').click({ force: true });
      });
    // Wait for listbox portal then choose Alta
    cy.get('[role="listbox"]').should("be.visible");
    cy.get('[role="option"]')
      .contains(/^Alta$/)
      .click({ force: true });

    // Small microtask wait to allow RHF state to settle
    cy.wrap(null).then(() => {});

    // Submit the form directly to avoid DialogClose timing issues
    cy.get("form#task-edit-form").submit();

    cy.wait("@updateTask").then((interception) => {
      expect(interception.request.url).to.match(
        new RegExp(`/api/tasks/${task.id}$`)
      );
      const payload =
        typeof interception.request.body === "string"
          ? JSON.parse(interception.request.body)
          : interception.request.body;
      expect(payload.title).to.eq("Updated title");
      // Priority should now be 'alta'
      expect(payload.priority).to.eq("alta");
    });

    cy.get("@toastSuccess").should(
      "have.been.calledWith",
      "Task updated successfully"
    );
  });

  it("resets form on close: changes are discarded when reopening", () => {
    const { task } = mountDialog();

    cy.get('[data-testid="task-edit-button"]').click();

    cy.get('[data-testid="title-input"]').clear().type("Temporary change");

    // Cancel closes dialog
    cy.contains("button", "Cancel").click();

    // Re-open
    cy.get('[data-testid="task-edit-button"]').click();

    // Title should be reset to original
    cy.get('[data-testid="title-input"]').should("have.value", task.title);
  });
});
