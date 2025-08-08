"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useMemo, useState } from "react";
import { TaskFilters, TaskPriority } from "@/types/Tasks";
import useAxiosClient from "@/hooks/useAxiosClient";
import TaskService from "@/services/taskService";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FilterIcon } from "lucide-react";
import CreateTaskForm from "./create-task-form";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { Combobox } from "@/components/ui/combo-box";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  setPagination,
  setTasks,
  setTasksFilters,
} from "@/lib/store/slices/tasks";
import { AxiosError } from "axios";

type TaskFiltersForm = {
  [K in keyof TaskFilters]?: string;
};

export default function Toolbar() {
  const usersState = useSelector((state: RootState) => state.users);
  const tasksState = useSelector((state: RootState) => state.task);
  const dispatch = useAppDispatch();

  const getTasksFilters: TaskFiltersForm = useMemo(() => {
    return {
      ...tasksState.tasksFilters,
      priority: tasksState.tasksFilters.priority?.toString(),
      completed: tasksState.tasksFilters.completed?.toString(),
      assigned_to: tasksState.tasksFilters.assigned_to?.toString(),
      created_by: tasksState.tasksFilters.created_by?.toString(),
      due_after: tasksState.tasksFilters.due_after?.toString(),
      due_before: tasksState.tasksFilters.due_before?.toString(),
      order_desc: tasksState.tasksFilters.order_desc?.toString(),
    };
  }, [tasksState.tasksFilters]);

  const [filters, setFilters] = useState<TaskFiltersForm>(getTasksFilters);
  const api = useAxiosClient();
  const taskService = new TaskService(api);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | { target: { name: string; value: string } }
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const convertedFilters: TaskFilters = {
      ...filters,
      priority:
        filters.priority && filters.priority !== "NONE"
          ? TaskPriority[filters.priority as keyof typeof TaskPriority]
          : undefined,
      completed:
        filters.completed === "true"
          ? true
          : filters.completed === "false"
          ? false
          : undefined,
      assigned_to: filters.assigned_to
        ? Number(filters.assigned_to)
        : undefined,
      created_by: filters.created_by ? Number(filters.created_by) : undefined,
      due_after: filters.due_after
        ? new Date(filters.due_after).toISOString()
        : undefined,
      due_before: filters.due_before
        ? new Date(filters.due_before).toISOString()
        : undefined,
      order_desc: filters.order_desc
        ? filters.order_desc === "true"
        : undefined,
    };
    dispatch(setTasksFilters(convertedFilters));

    try {
      const response = await taskService
        .getTasks(convertedFilters, 1, 10)
        .catch((err) => {
          console.log(err);
          const errorMessage = (err as AxiosError<{ detail?: string }>).response
            ?.data?.detail;
          toast.error(errorMessage || "Failed to fetch tasks");
        });
      dispatch(setTasks(response.tasks));
      dispatch(
        setPagination({
          page: response.page,
          size: response.size,
          total_pages: response.pages,
        })
      );
    } catch (error) {
      console.error("Failed to fetch tasks with filters:", error);
    }
  };

  return (
    <div data-testid="task-toolbar" className="filters-toolbar mb-6 flex flex-wrap justify-between gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-wrap gap-4 justify-center"
      >
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Keyword Search</Label>
          <Input
            data-testid="search-input"
            id="search"
            type="text"
            name="search"
            value={filters.search || ""}
            onChange={handleChange}
            placeholder="Search tasks..."
            className="w-96"
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Completed Filter */}
          <div className="space-y-2">
            <Label htmlFor="completed">Status</Label>
            <Select
              name="completed"
              value={filters.completed ?? ""}
              onValueChange={(value) =>
                handleChange({ target: { name: "completed", value } })
              }
            >
              <SelectTrigger data-testid="completion-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem data-value="true" value="true">Completed</SelectItem>
                <SelectItem data-value="false" value="false">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              name="priority"
              value={filters.priority ?? ""}
              onValueChange={(value) =>
                handleChange({ target: { name: "priority", value } })
              }
            >
              <SelectTrigger data-testid="priority-filter">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">All</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem data-value="alta" value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order By */}
          <div className="space-y-2">
            <Label htmlFor="order_by">Sort By</Label>
            <Select
              name="order_by"
              value={filters.order_by ?? "created_at"}
              onValueChange={(value) =>
                handleChange({ target: { name: "order_by", value } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created At</SelectItem>
                <SelectItem value="updated_at">Updated At</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order Direction */}
          <div className="space-y-2">
            <Label htmlFor="order_desc">Sort Direction</Label>
            <Select
              name="order_desc"
              value={filters.order_desc ?? "true"}
              onValueChange={(value) =>
                handleChange({ target: { name: "order_desc", value } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Descending</SelectItem>
                <SelectItem value="false">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* More Filters */}
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="open-more-filters" variant="outline" className="mt-4">
                <FilterIcon />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>More Filters</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {/* Assigned To */}
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assigned To</Label>
                  <Combobox
                    options={
                      usersState.users?.map((user) => ({
                        value: user.id.toString(),
                        label: user.username,
                      })) || []
                    }
                    selectedValue={filters.assigned_to}
                    onChange={(value) =>
                      handleChange({ target: { name: "assigned_to", value } })
                    }
                  />
                </div>

                {/* Created By */}
                <div className="space-y-2">
                  <Label htmlFor="created_by">Created By</Label>
                  <Combobox
                    options={
                      usersState.users?.map((user) => ({
                        value: user.id.toString(),
                        label: user.username,
                      })) || []
                    }
                    selectedValue={filters.created_by}
                    onChange={(value) =>
                      handleChange({ target: { name: "created_by", value } })
                    }
                  />
                </div>

                {/* Due After */}
                <div className="space-y-2">
                  <Label htmlFor="due_after">Due After</Label>
                  <DatePicker
                    id="due_after"
                    name="due_after"
                    value={filters.due_after || ""}
                    onChange={(value) =>
                      handleChange({
                        target: {
                          name: "due_after",
                          value: value?.toString() || "",
                        },
                      })
                    }
                  />
                </div>

                {/* Due Before */}
                <div className="space-y-2">
                  <Label htmlFor="due_before">Due Before</Label>
                  <DatePicker
                    id="due_before"
                    name="due_before"
                    value={filters.due_before || ""}
                    onChange={(value) =>
                      handleChange({
                        target: {
                          name: "due_before",
                          value: value?.toString() || "",
                        },
                      })
                    }
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-end">
            <Button data-testid="apply-filters" type="submit" className="w-full mt-2">
              Apply Filters
            </Button>
          </div>
        </div>
      </form>
      <div className="flex items-start">
        <CreateTaskForm />
      </div>
    </div>
  );
}
