"use client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import { Task } from "@/types/Tasks";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { UpdateTaskSchema } from "@/lib/schemas/tasksSchemas";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "../ui/input";
import { DatePicker } from "../ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import z from "zod";
import TaskService from "@/services/taskService";
import useAxiosClient from "@/hooks/useAxiosClient";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { Combobox } from "../ui/combo-box";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { Textarea } from "../ui/textarea";
import { useMemo, useState } from "react";

export default function TaskEditDialog({ task }: { task: Task }) {
  const defaultValues = useMemo(() => {
    return {
      title: task.title,
      description: task.description,
      due_date: task.due_date ? new Date(task.due_date) : null,
      priority: task.priority,
      assigned_to: task.assigned_to || undefined,
    };
  }, [task]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<UpdateTaskSchema>({
    defaultValues,
  });
  const usersState = useSelector((state: RootState) => state.users);
  const api = useAxiosClient();
  const taskService = new TaskService(api);

  const onSubmit = async (values: z.infer<typeof UpdateTaskSchema>) => {
    try {
      const response = await taskService.updateTask(task.id, values);
      if (response === 200) {
        toast.success("Task updated successfully");
      }
    } catch (error) {
      const errorMessage = (error as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(errorMessage || "Error updating task");
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    form.reset();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      <DialogTrigger>
        <Edit className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="task-edit-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel htmlFor="title">Title</FormLabel>
                  <FormControl>
                    <Input
                      id="title"
                      placeholder="Title"
                      type="text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel htmlFor="description">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      id="description"
                      placeholder="Description"
                      {...field}
                      value={field.value ?? ""}
                      rows={5}
                      className="resize-none max-h-[250px] min-h-[100px] overflow-y-auto"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel htmlFor="due_date">Due Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        id="due_date"
                        {...field}
                        value={
                          field.value
                            ? field.value.toISOString().split("T")[0]
                            : undefined
                        }
                        onChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel htmlFor="priority">Priority</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baja">Baja</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel htmlFor="assigned_to">Assigned To</FormLabel>
                  <FormControl>
                    <Combobox
                      options={
                        usersState.users?.map((user) => ({
                          value: user.id.toString(),
                          label: user.username,
                        })) || []
                      }
                      selectedValue={field.value?.toString()}
                      onChange={(value) =>
                        field.onChange(Number(value) || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" form="task-edit-form">
              Save changes
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
