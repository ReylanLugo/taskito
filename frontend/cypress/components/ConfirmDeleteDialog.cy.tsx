import React from "react";
import "@/app/globals.css";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";

// Helpers
const getDialog = () => cy.get('[data-testid="confirm-delete-dialog"]');
const waitForDialogOpen = () =>
  getDialog()
    .should("be.visible")
    .should(($el) => {
      const opacity = getComputedStyle($el[0]).opacity;
      expect(opacity, "dialog opacity").to.not.eq("0");
    });

describe("ConfirmDeleteDialog", () => {
  beforeEach(() => {
    cy.viewport(1000, 900);
  });

  it("renders default title/description and buttons when open", () => {
    const onOpenChange = cy.stub().as("onOpenChange");

    cy.mount(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={cy.stub()}
      />
    );

    waitForDialogOpen();

    cy.contains("h2, h3, h4", "Delete user").should("be.visible");
    cy.contains(/This action cannot be undone\./).should("be.visible");
    cy.get('[data-testid="cancel-button"]')
      .should("be.visible")
      .and("contain.text", "Cancel");
    cy.get('[data-testid="confirm-button"]')
      .should("be.visible")
      .and("contain.text", "Delete");
  });

  it("uses custom title, description and button labels when provided", () => {
    const onOpenChange = cy.stub().as("onOpenChange");

    cy.mount(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Remove item"
        description="Are you absolutely sure?"
        confirmText="Remove"
        cancelText="Back"
        onConfirm={cy.stub()}
      />
    );

    waitForDialogOpen();

    cy.contains("h2, h3, h4", "Remove item").should("be.visible");
    cy.contains("Are you absolutely sure?").should("be.visible");
    cy.get('[data-testid="cancel-button"]').should("contain.text", "Back");
    cy.get('[data-testid="confirm-button"]').should("contain.text", "Remove");
  });

  it("calls onConfirm, shows loading state, and closes on success", () => {
    const onOpenChange = cy.stub().as("onOpenChange");
    let resolveConfirm: (() => void) | null = null;
    const onConfirm = cy
      .stub()
      .callsFake(
        () =>
          new Promise<void>((resolve) => {
            resolveConfirm = resolve;
          })
      )
      .as("onConfirm");

    cy.mount(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );
    waitForDialogOpen();

    cy.get('[data-testid="confirm-button"]').click();
    cy.get("@onConfirm").should("have.been.calledOnce");

    // Should show loading and disable both buttons
    cy.get('[data-testid="confirm-button"]')
      .should("contain.text", "Deleting...")
      .and("be.disabled");
    cy.get('[data-testid="cancel-button"]').should("be.disabled");

    // Resolve and ensure dialog closes
    cy.then(() => resolveConfirm && resolveConfirm());
    cy.get("@onOpenChange").should("have.been.calledWith", false);
  });

  it("Cancel closes the dialog without confirming", () => {
    const onOpenChange = cy.stub().as("onOpenChange");
    const onConfirm = cy.stub().as("onConfirm");

    cy.mount(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );
    waitForDialogOpen();

    cy.get('[data-testid="cancel-button"]').click();
    cy.get("@onOpenChange").should("have.been.calledWith", false);
    cy.get("@onConfirm").should("not.have.been.called");
  });
});
