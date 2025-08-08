"use client";
import useAxiosClient from "@/hooks/useAxiosClient";
import { Suspense, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import dynamicImport from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import TaskService from "@/services/taskService";
import TasksGrid from "@/components/dashboard/TasksGrid";
import { AxiosError } from "axios";
import UsersService from "@/services/usersService";
import Image from "next/image";
import { useAppDispatch } from "@/lib/store/hooks";
import { setPagination, setTasks } from "@/lib/store/slices/tasks";
import AuthService from "@/services/authService";
const TasksPriorityChart = dynamicImport(
  () =>
    import("@/components/dashboard/tasks-priority-chart").then(
      (mod) => mod.TasksPriorityChart
    ),
  {
    ssr: false,
  }
);
const TasksDailyChart = dynamicImport(
  () =>
    import("@/components/dashboard/tasks-daily-chart").then(
      (mod) => mod.TasksDailyChart
    ),
  {
    ssr: false,
  }
);

export default function Dashboard() {
  const api = useAxiosClient();
  const { statistics } = useSelector((state: RootState) => state.task);
  const taskService = new TaskService(api);
  const authService = new AuthService(api);
  const usersService = new UsersService(api);
  const auth = useSelector((state: RootState) => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Fetch statistics
    taskService.getTasksStatistics().catch((err) => {
      console.log(err);
      const errorMessage = (err as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(errorMessage || "Failed to fetch statistics");
    });

    // Fetch users
    usersService.getUsers().catch((err) => {
      console.log(err);
      const errorMessage = (err as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(errorMessage || "Failed to fetch users");
    });

    // Fetch tasks
    taskService
      .getTasks()
      .then((res) => {
        dispatch(setTasks(res.tasks));
        dispatch(
          setPagination({
            page: res.page,
            size: res.size,
            total_pages: res.pages,
          })
        );
      })
      .catch((err) => {
        console.log(err);
        toast.error(
          (err as AxiosError<{ detail?: string }>).response?.data?.detail ||
            "Failed to fetch tasks"
        );
      });

    // Fetch auth user if not exists
    if (!auth?.id) {
      authService.getUser()
    }
  }, []);

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Image src="/logo.png" alt="Logo" width={100} height={100} />
        <div className="flex items-center gap-2">
          <span className="text-xl text-center font-bold bg-gray-400 rounded-full w-12 h-12 flex items-center justify-center">
            {auth?.username.charAt(0).toUpperCase()}
          </span>
          <p className="font-semibold">{auth?.username}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Tasks" value={statistics.total_tasks} />
        <StatsCard title="Completed Tasks" value={statistics.completed_tasks} />
        <StatsCard title="Pending Tasks" value={statistics.pending_tasks} />
        <StatsCard title="Overdue Tasks" value={statistics.overdue_tasks} />
      </div>
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
          <Card>
            <CardHeader>
              <CardTitle>Task Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <TasksPriorityChart
                data={[
                  { name: "High", value: statistics.high_priority_tasks },
                  { name: "Medium", value: statistics.medium_priority_tasks },
                  { name: "Low", value: statistics.low_priority_tasks },
                ]}
              />
            </CardContent>
          </Card>
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
          <Card>
            <CardHeader>
              <CardTitle>Tasks Created This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <TasksDailyChart />
            </CardContent>
          </Card>
        </Suspense>
      </div>
      <TasksGrid />
    </main>
  );
}
