import React from "react";
import { PriorityLabel } from "@/components/shared/priority-label";
import { TaskPriority } from "@/types/Tasks";
import "@/app/globals.css";
// Verifies that the text and style classes are correct by priority
// and that the data-testid provides stable selectors.

describe("PriorityLabel", () => {
  const mountLabel = (priority: TaskPriority) => {
    cy.mount(
      <div style={{ padding: 8 }}>
        <PriorityLabel priority={priority} />
      </div>
    );
  };

  it("renders High with red classes", () => {
    mountLabel(TaskPriority.HIGH);
    cy.get('[data-testid="priority-label"]').should("exist");
    cy.get('[data-testid="priority-text"]').should("have.text", "High");
    cy.get('[data-testid="priority-text"]').should("have.class", "bg-red-500");
    cy.get('[data-testid="priority-text"]').should("have.class", "text-white");
  });

  it("renders Medium with yellow classes", () => {
    mountLabel(TaskPriority.MEDIUM);
    cy.get('[data-testid="priority-text"]').should("have.text", "Medium");
    cy.get('[data-testid="priority-text"]').should("have.class", "bg-yellow-500");
    cy.get('[data-testid="priority-text"]').should("have.class", "text-white");
  });

  it("renders Low with blue classes", () => {
    mountLabel(TaskPriority.LOW);
    cy.get('[data-testid="priority-text"]').should("have.text", "Low");
    cy.get('[data-testid="priority-text"]').should("have.class", "bg-blue-500");
    cy.get('[data-testid="priority-text"]').should("have.class", "text-white");
  });
});
