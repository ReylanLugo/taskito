import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo, useState } from "react";
import { UserWithStats, User } from "@/types/User";
import { Button } from "../ui/button";
import { Task } from "@/types/Tasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function UsersTable({
  users,
  openEdit,
  requestDelete,
  openTaskDialog,
}: {
  users: UserWithStats[];
  openEdit: (u: User) => void;
  requestDelete: (u: User) => void;
  openTaskDialog: (task: Task | null, title: string) => void;
}) {
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<
    keyof User | "total" | "completed" | "overdue"
  >("username");

  const sorted = useMemo(() => {
    const clone = [...users];
    clone.sort((a, b) => {
      const getVal = (r: UserWithStats) => {
        if (
          sortKey === "total" ||
          sortKey === "completed" ||
          sortKey === "overdue"
        )
          return r[sortKey];
        const v = r.user[sortKey];
        return typeof v === "string" ? v.toLowerCase() : (v as any);
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });
    return clone;
  }, [users, sortKey, sortDesc]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  const oldestOverdue = (tasks: Task[]) => {
    const now = new Date();
    return tasks
      .filter((t) => !t.completed && t.due_date && new Date(t.due_date) < now)
      .sort(
        (a, b) =>
          new Date(a.due_date || 0).getTime() -
          new Date(b.due_date || 0).getTime()
      )[0];
  };

  const nextDue = (tasks: Task[]) => {
    const now = new Date();
    return tasks
      .filter((t) => !t.completed && t.due_date && new Date(t.due_date) >= now)
      .sort(
        (a, b) =>
          new Date(a.due_date || 0).getTime() -
          new Date(b.due_date || 0).getTime()
      )[0];
  };

  return (
    <Table className={cn("w-full ", users.length === 0 && "min-h-96")}>
      <TableHeader>
        <TableRow>
          <TableHead
            onClick={() => toggleSort("username")}
            className="cursor-pointer"
          >
            Username
          </TableHead>
          <TableHead
            onClick={() => toggleSort("email")}
            className="cursor-pointer"
          >
            Email
          </TableHead>
          <TableHead
            onClick={() => toggleSort("role")}
            className="cursor-pointer"
          >
            Role
          </TableHead>
          <TableHead
            onClick={() => toggleSort("total")}
            className="cursor-pointer"
          >
            Tasks
          </TableHead>
          <TableHead
            onClick={() => toggleSort("completed")}
            className="cursor-pointer"
          >
            Completed
          </TableHead>
          <TableHead
            onClick={() => toggleSort("overdue")}
            className="cursor-pointer"
          >
            Overdue
          </TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(({ user, tasks, total, completed, overdue }) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.username}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <span
                className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                  user.role === "admin"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {user.role}
              </span>
            </TableCell>
            <TableCell>{total}</TableCell>
            <TableCell>{completed}</TableCell>
            <TableCell>{overdue}</TableCell>
            <TableCell className="space-x-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openEdit(user)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => requestDelete(user)}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const t = oldestOverdue(tasks);
                  if (!t) {
                    toast.info("No tasks found.");
                    return;
                  }
                  openTaskDialog(t, "Oldest overdue task");
                }}
              >
                Oldest overdue
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const t = nextDue(tasks);
                  if (!t) {
                    toast.info("No tasks found.");
                    return;
                  }
                  openTaskDialog(t, "Next due task");
                }}
              >
                Next due
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
