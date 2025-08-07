import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton component for the daily chart while loading
export function TasksDailyChartSkeleton() {
  return (
    <div className="w-full h-[300px] flex flex-col items-center justify-center space-y-4">
      <div className="w-full flex items-end justify-between px-8 space-x-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton 
            key={index} 
            className={`h-${Math.max(10, Math.floor(Math.random() * 20) + 10)}  w-[10%]`} 
          />
        ))}
      </div>
      <div className="w-full flex justify-between px-4">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <Skeleton key={day} className="h-4 w-8" />
        ))}
      </div>
    </div>
  );
}

// The actual chart component
export function TasksDailyChartComponent() {
  const { tasks } = useSelector((state: RootState) => state.task);
  // Get the current week's days (Monday to Sunday)
  const today = new Date();
  const firstDayOfWeek = new Date(today);
  firstDayOfWeek.setDate(
    today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)
  ); // Adjust so Monday is first

  // Initialize an array for the week days
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(firstDayOfWeek);
    day.setDate(firstDayOfWeek.getDate() + i);
    weekDays.push(day);
  }

  // Format the days for display (e.g., "Mon", "Tue")
  const dayNames = weekDays.map((day) =>
    day.toLocaleDateString("en-US", { weekday: "short" })
  );

  // Count tasks for each day
  const data = useMemo(
    () =>
      weekDays.map((day, index) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const count = tasks?.filter((task) => {
          const taskDate = new Date(task.created_at);
          return taskDate >= dayStart && taskDate <= dayEnd;
        }).length;

        return {
          name: dayNames[index],
          count,
        };
      }),
    [tasks, weekDays, dayNames, firstDayOfWeek]
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#2b7fff" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Export the component with dynamic loading
const TasksDailyChart = dynamic(
  () => Promise.resolve(TasksDailyChartComponent),
  {
    ssr: false,
    loading: () => <TasksDailyChartSkeleton />
  }
);

export { TasksDailyChart };
