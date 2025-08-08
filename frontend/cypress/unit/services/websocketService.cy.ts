// Cypress unit-style test for the WebSocketService message handling
// We call the internal handleMessage to avoid creating a real WebSocket connection.

import wsService from "../../../services/websocketService";

// Helper to call the private handleMessage
const handle = (channel: string, data: any) => (wsService as any).handleMessage(channel, data);

describe("WebSocketService.handleMessage", () => {
  beforeEach(() => {
    // Provide a fresh dispatch spy for each test
    const dispatch = cy.spy().as("dispatch");
    (wsService as any).dispatch = dispatch;
    // Ensure no current user id by default
    (wsService as any).currentUserId = undefined;
  });

  it("dispatches add/update/delete actions for task events", () => {
    const created = { id: 1, title: "A" };
    const updated = { id: 1, title: "B" };
    const deleted = { id: 1 };

    // created
    handle("tasks", JSON.stringify({ type: "task", event: "created", data: created }));
    // updated
    handle("tasks", JSON.stringify({ type: "task", event: "updated", data: updated }));
    // deleted (by id in data)
    handle("tasks", JSON.stringify({ type: "task", event: "deleted", data: deleted }));
    // deleted (by direct number data)
    handle("tasks", JSON.stringify({ type: "task", event: "deleted", data: 2 }));

    cy.get<sinon.SinonSpy>("@dispatch").then((dispatch) => {
      // Should have been called 4 times
      expect(dispatch.callCount).to.eq(4);

      const [a1, a2, a3, a4] = dispatch.getCalls().map((c) => c.args[0]);

      // RTK action creators include a type and payload
      expect(a1).to.have.property("type").and.to.match(/addTask$/);
      expect(a1).to.have.property("payload").deep.eq(created);

      expect(a2).to.have.property("type").and.to.match(/updateTask$/);
      expect(a2).to.have.property("payload").deep.eq(updated);

      expect(a3).to.have.property("type").and.to.match(/deleteTask$/);
      expect(a3).to.have.property("payload").deep.eq(1);

      expect(a4).to.have.property("type").and.to.match(/deleteTask$/);
      expect(a4).to.have.property("payload").deep.eq(2);
    });
  });

  it("ignores events originated by the same user (meta.actor_id)", () => {
    (wsService as any).currentUserId = 7;
    handle(
      "tasks",
      JSON.stringify({ type: "task", event: "created", data: { id: 9 }, meta: { actor_id: 7 } })
    );

    cy.get<sinon.SinonSpy>("@dispatch").then((dispatch) => {
      expect(dispatch.callCount).to.eq(0);
    });
  });

  it("tolerates malformed messages without throwing errors", () => {
    // Non-JSON message
    handle("tasks", "not-json");
    // JSON message but without expected fields
    handle("tasks", JSON.stringify({ foo: "bar" }));

    cy.get<sinon.SinonSpy>("@dispatch").then((dispatch) => {
      // Should not dispatch anything
      expect(dispatch.callCount).to.eq(0);
    });
  });
});
