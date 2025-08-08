import React from "react";
import "@/app/globals.css";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { Role, User } from "@/types/User";

// Helper to make a user
const makeUser = (overrides: Partial<User> = {}): User => ({
  id: overrides.id ?? 1,
  username: overrides.username ?? "johndoe",
  email: overrides.email ?? "john@example.com",
  role: overrides.role ?? Role.USER,
  is_active: overrides.is_active ?? true,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
});

// Scoped query helpers
const getDialog = () => cy.get('[data-testid="edit-user-dialog"]');
const waitForDialogOpen = () =>
  getDialog()
    .should('have.attr', 'data-state', 'open')
    .should(($el) => {
      const opacity = getComputedStyle($el[0]).opacity;
      expect(opacity, 'dialog opacity').to.eq('1');
    });

describe("EditUserDialog", () => {
  beforeEach(() => {
    cy.viewport(1000, 900);
  });

  it("prefills fields with provided user and renders controls", () => {
    const user = makeUser({ username: "alice", email: "alice@acme.com", role: Role.ADMIN, is_active: false });
    const onOpenChange = cy.stub().as("onOpenChange");

    cy.mount(
      <EditUserDialog open={true} onOpenChange={onOpenChange} user={user} onSubmit={cy.stub()} />
    );

    // Ensure dialog finished opening animations
    waitForDialogOpen();

    // Title
    cy.contains("h2, h3, h4", "Edit user").should("be.visible");

    // Inputs prefilled
    cy.get('#username').should('have.value', 'alice');
    cy.get('#email').should('have.value', 'alice@acme.com');

    // Role select shows Admin
    getDialog().find('[data-testid="role-select-trigger"]').should('contain.text', 'Admin');

    // Switch reflects inactive state
    getDialog().find('[data-testid="active-switch"]').should('have.attr', 'aria-checked', 'false');
  });

  it("allows editing values and calls onSubmit with updated payload, then closes on success", () => {
    const user = makeUser({ username: "bob", email: "bob@acme.com", role: Role.USER, is_active: true });
    const onOpenChange = cy.stub().as("onOpenChange");
    const onSubmit = cy.stub().as("onSubmit");

    cy.mount(
      <EditUserDialog open={true} onOpenChange={onOpenChange} user={user} onSubmit={onSubmit} />
    );

    // Ensure dialog finished opening animations
    waitForDialogOpen();

    // Change username and email
    cy.get('#username').clear().type('robert');
    cy.get('#email').clear().type('robert@company.com');

    // Change role to Admin
    getDialog().find('[data-testid="role-select-trigger"]').click();
    cy.get('[data-testid="role-option-admin"]').click();
    getDialog().find('[data-testid="role-select-trigger"]').should('contain.text', 'Admin');

    // Toggle active to false
    getDialog().find('[data-testid="active-switch"]').click().should('have.attr','aria-checked','false');

    // Save
    cy.get('[data-testid="save-button"]').click();

    cy.get('@onSubmit').should('have.been.calledOnce');
    cy.get('@onSubmit').its('lastCall.args.0').should((payload: any) => {
      expect(payload).to.deep.equal({
        username: 'robert',
        email: 'robert@company.com',
        role: Role.ADMIN,
        is_active: false,
      });
    });

    // Component closes after successful submit
    cy.get('@onOpenChange').should('have.been.calledWith', false);
  });

  it("Cancel closes the dialog without submitting", () => {
    const user = makeUser();
    const onOpenChange = cy.stub().as("onOpenChange");
    const onSubmit = cy.stub().as("onSubmit");

    cy.mount(
      <EditUserDialog open={true} onOpenChange={onOpenChange} user={user} onSubmit={onSubmit} />
    );

    // Ensure dialog finished opening animations
    waitForDialogOpen();

    cy.get('[data-testid="cancel-button"]').click();
    cy.get('@onOpenChange').should('have.been.calledWith', false);
    cy.get('@onSubmit').should('not.have.been.called');
  });

  it("shows loading state and disables actions while submitting (pending promise)", () => {
    const user = makeUser();
    const onOpenChange = cy.stub().as("onOpenChange");

    let resolveSubmit: (() => void) | null = null;
    const onSubmit = cy.stub().callsFake(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    })).as("onSubmit");

    cy.mount(
      <EditUserDialog open={true} onOpenChange={onOpenChange} user={user} onSubmit={onSubmit} />
    );

    // Ensure dialog finished opening animations
    waitForDialogOpen();

    // Trigger submit
    cy.get('[data-testid=\"save-button\"]').click();

    // Loading state visible and buttons disabled
    cy.get('[data-testid=\"save-button\"]').should('contain.text', 'Saving...').and('be.disabled');
    cy.get('[data-testid=\"cancel-button\"]').should('be.disabled');

    // Resolve the promise to complete submission
    cy.then(() => resolveSubmit && resolveSubmit());

    // After resolve, dialog should close
    cy.get('@onOpenChange').should('have.been.calledWith', false);
  });
});
