import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const COLORS = ['#fb2c36', '#f0b100', '#2b7fff'];

interface TasksPriorityChartProps {
  data: { name: string; value: number }[];
}

// Skeleton component for the chart while loading
export function TasksPriorityChartSkeleton() {
  return (
    <div className="w-full h-80 flex flex-col items-center justify-center space-y-4">
      <Skeleton className="h-[160px] w-[160px] rounded-full" />
      <div className="w-full flex justify-center space-x-4">
        <Skeleton className="h-4 w-[60px]" />
        <Skeleton className="h-4 w-[60px]" />
        <Skeleton className="h-4 w-[60px]" />
      </div>
    </div>
  );
}

// The actual chart component
export function TasksPriorityChartComponent({ data }: TasksPriorityChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) =>
              percent !== undefined ? `${name}: ${(percent * 100).toFixed(0)}%` : name
            }
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Export the component with dynamic loading
const TasksPriorityChart = dynamic(
  () => Promise.resolve(TasksPriorityChartComponent),
  {
    ssr: false,
    loading: () => <TasksPriorityChartSkeleton />
  }
);

export { TasksPriorityChart };