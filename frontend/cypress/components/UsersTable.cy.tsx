import React from "react";
import "@/app/globals.css";
import UsersTable from "@/components/admin/users-table";
import { Toaster } from "@/components/ui/sonner";
import { TaskPriority, Task } from "@/types/Tasks";
import { Role, User, UserWithStats } from "@/types/User";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: overrides.id ?? Math.floor(Math.random() * 100000),
  title: overrides.title ?? "Task",
  description: overrides.description ?? "desc",
  completed: overrides.completed ?? false,
  created_by: overrides.created_by ?? 1,
  assigned_to: overrides.assigned_to ?? 1,
  priority: overrides.priority ?? TaskPriority.MEDIUM,
  due_date: overrides.due_date ?? "",
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
  comments: overrides.comments ?? [],
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: overrides.id ?? Math.floor(Math.random() * 100000),
  username: overrides.username ?? "user",
  email: overrides.email ?? "user@example.com",
  role: overrides.role ?? Role.USER,
  is_active: overrides.is_active ?? true,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
});

const makeRow = (user: User, tasks: Task[] = []): UserWithStats => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const now = new Date();
  const overdue = tasks.filter(
    (t) => !t.completed && t.due_date && new Date(t.due_date) < now
  ).length;
  return { user, tasks, total, completed, overdue };
};

const mountTable = (rows: UserWithStats[], handlers?: any) => {
  const defaults = {
    openEdit: cy.stub().as("openEdit"),
    requestDelete: cy.stub().as("requestDelete"),
    openTaskDialog: cy.stub().as("openTaskDialog"),
  };
  const props = { ...defaults, ...handlers };
  cy.mount(
    <>
      <Toaster />
      <UsersTable users={rows} {...props} />
    </>
  );
  return props;
};

// Helper: get column index by header label
const getColIndex = (label: string) =>
  cy.get("thead tr th").then(($ths) => {
    const idx = Array.from($ths).findIndex((th) =>
      th.textContent?.toLowerCase().includes(label.toLowerCase())
    );
    expect(idx, `column index for ${label}`).to.be.gte(0);
    return idx;
  });

describe("UsersTable", () => {
  beforeEach(() => {
    cy.viewport(1000, 900);
  });

  it("renders users and role badges, and triggers action handlers", () => {
    const admin = makeUser({
      id: 1,
      username: "Admin",
      email: "a@a.com",
      role: Role.ADMIN,
    });
    const normal = makeUser({
      id: 2,
      username: "bob",
      email: "b@b.com",
      role: Role.USER,
    });
    const rows = [makeRow(admin), makeRow(normal)];

    mountTable(rows);

    // Rendered cells
    cy.contains("td.font-medium", "Admin").should("be.visible");
    cy.contains("td", "b@b.com").should("be.visible");

    // Role badge classes
    cy.contains("td", "admin").find("span").should("have.class", "bg-red-100");
    cy.contains("td", "user").find("span").should("have.class", "bg-slate-100");

    // Action buttons call handlers (locate row by username cell)
    cy.contains("td.font-medium", /^admin$/i)
      .parents("tr")
      .within(() => {
        cy.contains("button", "Edit").click();
        cy.contains("button", "Delete").click();
      });

    cy.get("@openEdit").should("have.been.calledOnce");
    cy.get("@requestDelete").should("have.been.calledOnce");
  });

  it("chooses the oldest overdue task or shows toast if none", () => {
    const u = makeUser({ id: 1, username: "alice" });
    const past1 = makeTask({
      id: 10,
      title: "past1",
      due_date: new Date(Date.now() - 3 * 86400000).toISOString(),
    });
    const past2 = makeTask({
      id: 11,
      title: "past2",
      due_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    });
    const future = makeTask({
      id: 12,
      title: "future",
      due_date: new Date(Date.now() + 86400000).toISOString(),
    });
    const rows = [makeRow(u, [past1, past2, future])];

    mountTable(rows);

    // Oldest overdue -> should pick past2 (older)
    cy.contains("td.font-medium", /^alice$/)
      .parents("tr")
      .within(() => {
        cy.contains("button", "Oldest overdue").click();
      });

    cy.get("@openTaskDialog")
      .should("have.been.called")
      .then((stub: any) => {
        const args = stub.getCalls()[0].args;
        expect(args[0].id).to.eq(11);
        expect(args[1]).to.eq("Oldest overdue task");
      });

    // No overdue -> show toast and do not call openTaskDialog again
    const done = makeTask({
      id: 20,
      title: "done",
      completed: true,
      due_date: new Date(Date.now() - 86400000).toISOString(),
    });
    const onlyFuture = [future, done];
    cy.mount(
      <>
        <Toaster />
        <UsersTable
          users={[makeRow(u, onlyFuture)]}
          openEdit={cy.stub()}
          requestDelete={cy.stub()}
          openTaskDialog={cy.stub().as("openTaskDialog2")}
        />
      </>
    );

    cy.contains("button", "Oldest overdue").click();
    cy.get("[data-sonner-toast]", { timeout: 3000 }).should("exist");
    cy.get("@openTaskDialog2").should("not.have.been.called");
  });

  it("chooses the next due task or shows toast if none", () => {
    const u = makeUser({ id: 2, username: "charlie" });
    const future1 = makeTask({
      id: 30,
      title: "f1",
      due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
    });
    const future2 = makeTask({
      id: 31,
      title: "f2",
      due_date: new Date(Date.now() + 1 * 86400000).toISOString(),
    });
    const rows = [makeRow(u, [future1, future2])];

    mountTable(rows);

    // Next due -> should pick the earliest in the future (future2)
    cy.contains("td.font-medium", /^charlie$/)
      .parents("tr")
      .within(() => {
        cy.contains("button", "Next due").click();
      });

    cy.get("@openTaskDialog")
      .should("have.been.called")
      .then((stub: any) => {
        const args = stub.getCalls()[0].args;
        expect(args[0].id).to.eq(31);
        expect(args[1]).to.eq("Next due task");
      });

    // None available -> toast
    cy.mount(
      <>
        <Toaster />
        <UsersTable
          users={[makeRow(u, [])]}
          openEdit={cy.stub()}
          requestDelete={cy.stub()}
          openTaskDialog={cy.stub().as("openTaskDialog3")}
        />
      </>
    );
    cy.contains("button", "Next due").click();
    cy.get("[data-sonner-toast]").should("exist");
    cy.get("@openTaskDialog3").should("not.have.been.called");
  });

  it("sorts by username/email/role and numeric fields toggling asc/desc", () => {
    const u1 = makeUser({
      id: 1,
      username: "zoe",
      email: "z@z.com",
      role: Role.USER,
    });
    const u2 = makeUser({
      id: 2,
      username: "ann",
      email: "a@a.com",
      role: Role.ADMIN,
    });
    const now = Date.now();
    const rows: UserWithStats[] = [
      makeRow(u1, [
        makeTask({
          id: 101,
          due_date: new Date(now + 2 * 86400000).toISOString(),
        }),
        makeTask({
          id: 102,
          completed: true,
          due_date: new Date(now - 86400000).toISOString(),
        }),
      ]),
      makeRow(u2, [
        makeTask({
          id: 202,
          completed: false,
          due_date: new Date(now - 2 * 86400000).toISOString(),
        }),
      ]),
    ];

    mountTable(rows);

    // Username sort (default key is username, initial asc)
    cy.get("thead th").contains("Username").click(); // toggle to desc
    cy.get("tbody tr").first().find("td").first().should("contain", "zoe");
    cy.get("thead th").contains("Username").click(); // back to asc
    cy.get("tbody tr").first().find("td").first().should("contain", "ann");

    // Email sort
    cy.get("thead th").contains("Email").click(); // set key=email asc
    cy.get("tbody tr").first().find("td").eq(1).should("contain", "a@a.com");
    cy.get("thead th").contains("Email").click(); // desc
    cy.get("tbody tr").first().find("td").eq(1).should("contain", "z@z.com");

    // Role sort
    cy.get("thead th").contains("Role").click(); // asc (admin before user)
    cy.get("tbody tr").first().find("td").eq(2).should("contain", "admin");

    // Numeric: Tasks
    cy.get("thead th").contains("Tasks").click(); // asc by total
    getColIndex("Tasks").then((idx) => {
      cy.get("tbody tr")
        .first()
        .find("td")
        .eq(idx as number)
        .should("contain", "1");
    });
    cy.get("thead th").contains("Tasks").click(); // desc
    getColIndex("Tasks").then((idx) => {
      cy.get("tbody tr")
        .first()
        .find("td")
        .eq(idx as number)
        .should("contain", "2");
    });

    // Numeric: Completed
    cy.get("thead th").contains("Completed").click();
    getColIndex("Completed").then((idx) => {
      cy.get("tbody tr")
        .first()
        .find("td")
        .eq(idx as number)
        .should("contain", "0");
    });

    // Numeric: Overdue (assert by row order)
    cy.get("thead th").contains("Overdue").click(); // asc: zoe (0) first
    cy.get("tbody tr").first().find("td.font-medium").should("contain", "zoe");
    cy.get("thead th").contains("Overdue").click(); // desc: ann (1) first
    cy.get("tbody tr").first().find("td.font-medium").should("contain", "ann");
  });
});
