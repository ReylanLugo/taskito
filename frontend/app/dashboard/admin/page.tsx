"use client";

import { useEffect, useState, useTransition } from "react";
import useAxiosClient from "@/hooks/useAxiosClient";
import AuthService from "@/services/authService";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { useAppDispatch } from "@/lib/store/hooks";
import { setUser } from "@/lib/store/slices/auth";
import Image from "next/image";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { TaskDialog } from "@/components/admin/task-dialog";
import { Role, User, UserWithStats } from "@/types/User";
import { Task } from "@/types/Tasks";
import UsersService from "@/services/usersService";
import dynamic from "next/dynamic";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const UsersTable = dynamic(() => import("@/components/admin/users-table"), {
  ssr: false,
  loading: () => <div className="w-full h-96 animate-pulse bg-slate-100"></div>,
});

export default function AdminPage() {
  const [pending, startTransition] = useTransition();

  const api = useAxiosClient();
  const authService = new AuthService(api);
  const userService = new UsersService(api);

  const authStore = useSelector((state: RootState) => state.auth);
  const { users } = useSelector((state: RootState) => state.users);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [rows, setRows] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogTitle, setTaskDialogTitle] = useState<string>("Task");

  useEffect(() => {
    startTransition(async () => {
      try {
        const user = await authService.getUser();
        dispatch(setUser(user));
      } finally {
        setAuthResolved(true);
      }
    });
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        await userService.getUsers();
      } catch (e) {
        const error = e as AxiosError<{ detail?: string }>;
        toast.error(error.response?.data?.detail || "Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };
    if (authStore.role === Role.ADMIN) {
      fetchUsers();
    }
  }, [authStore.role]);


  useEffect(() => {
    const buildRows = async () => {
      setLoading(true);
      try {
        const withTasks = await Promise.all(
          users.map(async (u) => {
            const tasks: Task[] = await userService.getUsersTasks(u.id);
            const now = new Date();
            const total = tasks.length;
            const completed = tasks.filter((t) => t.completed).length;
            const overdue = tasks.filter(
              (t) => !t.completed && t.due_date && new Date(t.due_date) < now
            ).length;
            return {
              user: u,
              tasks,
              total,
              completed,
              overdue,
            } as UserWithStats;
          })
        );
        setRows(withTasks);
      } catch (e) {
        const error = e as AxiosError<{ detail?: string }>;
        toast.error(error.response?.data?.detail || "Failed to build user rows");
      } finally {
        setLoading(false);
      }
    };
    if (authStore.role === Role.ADMIN && users) {
      buildRows();
    }
  }, [users, authStore.role]);

  const requestDelete = (u: User) => {
    setSelectedUser(u);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const status = await userService.deleteUser(selectedUser.id);
      if (status === 204) {
        toast.success("User deleted successfully");
        setRows((r) => r.filter((x) => x.user.id !== selectedUser.id));
      }
    } catch (e) {
      const error = e as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const openEdit = (u: User) => {
    setSelectedUser(u);
    setEditOpen(true);
  };

  const submitEdit = async (values: {
    username: string;
    email: string;
    role: Role;
    is_active: boolean;
  }) => {
    if (!selectedUser) return;
    const { username, email, role, is_active } = values;
    try {
      const status = await userService.updateUser(selectedUser.id, {
        username,
        email,
        role,
        is_active,
      });
      if (status === 200) {
        toast.success("User updated successfully");
        setRows((prev) =>
          prev.map((row) =>
            row.user.id === selectedUser.id
              ? {
                  ...row,
                  user: { ...row.user, username, email, role, is_active },
                }
              : row
          )
        );
      }
    } catch (e) {
      const error = e as AxiosError<{ detail?: string }>;
      toast.error(error.response?.data?.detail || "Failed to update user");
    }
  };

  const openTaskDialog = (task: Task | null, title: string) => {
    setSelectedTask(task);
    setTaskDialogTitle(title);
    setTaskOpen(!!task);
  };

  if (!authResolved || pending) {
    return (
      <main className="p-4 max-w-7xl mx-auto">
        <div className="rounded-md border">
          <div className="w-full h-96 animate-pulse bg-slate-100 rounded-md"></div>
        </div>
      </main>
    );
  }

  if (authStore.role !== "admin") {
    return (
      <div className="flex justify-center items-center h-screen">
        <Image src="/logo.png" alt="Logo" width={100} height={100} />
        <h1 className="text-2xl font-bold text-slate-800 my-6">Unauthorized</h1>
      </div>
    );
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Image src="/logo.png" alt="Logo" width={100} height={100} />
        <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
        <div className="flex items-center gap-2">
          <span className="text-xl text-center font-bold bg-gray-400 rounded-full w-12 h-12 flex items-center justify-center">
            {authStore.username.charAt(0).toUpperCase()}
          </span>
          <p className="font-semibold">{authStore.username}</p>
          <Button
            onClick={() => {
              authService.logout();
              router.push("/");
            }}
          >
            <LogOut />
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        {loading ? (
          <div className="w-full h-96 animate-pulse bg-slate-100 rounded-md"></div>
        ) : (
          <UsersTable
            users={rows}
            openEdit={openEdit}
            requestDelete={requestDelete}
            openTaskDialog={openTaskDialog}
          />
        )}
      </div>
      {/* Dialogs */}
      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={selectedUser}
        onSubmit={submitEdit}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete user"
        description={`This will permanently delete user ${
          selectedUser?.username ?? ""
        }.`}
        onConfirm={confirmDelete}
      />
      <TaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        task={selectedTask}
        title={taskDialogTitle}
      />
    </main>
  );
}
