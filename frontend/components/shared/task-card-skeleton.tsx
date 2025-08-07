export const TaskSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow animate-pulse">
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mb-4"></div>
    <div className="flex justify-between items-center mt-4">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
    </div>
  </div>
);

export default TaskSkeleton;

