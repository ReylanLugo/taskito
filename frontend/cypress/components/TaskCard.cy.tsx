import React from "react";
import { TaskCard } from "@/components/shared/task-card";
import { Task, TaskPriority } from "@/types/Tasks";
import "@/app/globals.css";

const baseTask: Omit<Task, 'due_date'> = {
  id: 101,
  title: "Implement authentication flow",
  description: "Add login, logout and token refresh endpoints.",
  completed: false,
  priority: TaskPriority.MEDIUM,
  created_by: 1,
  assigned_to: 2,
  comments: [],
  created_at: "2025-08-05T10:00:00Z",
  updated_at: "2025-08-05T10:00:00Z",
};

describe("TaskCard", () => {
  const mountCard = (taskOverrides: Partial<Task> = {}) => {
    const task = { ...baseTask, ...taskOverrides } as Task;
    const onComplete = cy.spy().as("onComplete");
    const onDelete = cy.spy().as("onDelete");

    cy.mount(
      <div style={{ width: 360 }}>
        <TaskCard
          task={task}
          markTaskAsCompleted={onComplete}
          deleteTask={onDelete}
        />
      </div>
    );

    return { task };
  };

  it("renders title, description, priority and due date when provided", () => {
    cy.viewport(1000, 800);
    // Provide a due date
    mountCard({ due_date: "2025-08-15T00:00:00Z", priority: TaskPriority.HIGH });

    cy.get('[data-testid="task-card"]').should("exist");
    cy.get('[data-testid="task-title"]').should("contain.text", baseTask.title);
    cy.get('[data-testid="task-description"]').should("contain.text", baseTask.description);

    // Priority pill should be present (text from PriorityLabel)
    cy.contains(/High|Medium|Low/).should("exist");

    // Due date text should be non-empty when due_date exists
    cy.get('[data-testid="task-due-date"]').invoke("text").should((txt) => {
      expect(txt.trim().length).to.be.greaterThan(0);
    });
  });

  it("omits due date text when due date is not provided", () => {
    cy.viewport(1000, 800);
    mountCard({});
    cy.get('[data-testid="task-due-date"]').invoke("text").should((txt) => {
      expect(txt.trim()).to.eq("");
    });
  });

  it("calls markTaskAsCompleted with task id when clicking the button", () => {
    cy.viewport(1000, 800);
    const { task } = mountCard({ completed: false });
    cy.get('[data-testid="mark-task-as-completed"]').should("be.visible").click();
    cy.get('@onComplete').should('have.been.calledOnceWith', task.id);
  });

  it("shows completed indicator when task is completed", () => {
    cy.viewport(1000, 800);
    mountCard({ completed: true });
    cy.get('[data-testid="completed-indicator"]').should("be.visible").and("contain.text", "Completed");
    cy.get('[data-testid="mark-task-as-completed"]').should("not.exist");
  });

  it("calls deleteTask with task id when clicking delete button", () => {
    cy.viewport(1000, 800);
    const { task } = mountCard();
    cy.get('[data-testid="delete-task"]').click();
    cy.get('@onDelete').should('have.been.calledOnceWith', task.id);
  });
});
