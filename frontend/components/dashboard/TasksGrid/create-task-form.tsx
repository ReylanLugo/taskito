import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTaskSchema } from "@/lib/schemas/tasksSchemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { z } from "zod";
import useAxiosClient from "@/hooks/useAxiosClient";
import TaskService from "@/services/taskService";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { Combobox } from "@/components/ui/combo-box";

type FormValues = z.input<typeof CreateTaskSchema>;

export default function CreateTaskForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      due_date: null,
      priority: "baja",
      assigned_to: null,
    },
  });
  const api = useAxiosClient();
  const taskService = new TaskService(api);
  const usersState = useSelector((state: RootState) => state.users);

  const onSubmit = async (values: FormValues) => {
    try {
      const task = await taskService.createTask({
        title: values.title,
        priority: values.priority || "baja",
        description: values.description,
        due_date:
          values.due_date && typeof values.due_date === "string"
            ? new Date(values.due_date)
            : undefined,
        assigned_to: values.assigned_to || undefined,
      });

      if (task === 201) {
        toast.success("Task created successfully!");
        form.reset();
      }
    } catch (error) {
      console.error("Error creating task:", error);
      const errorMessage = (error as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
    }
  };

  return (
    <div className="flex items-start">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Task description"
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
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={(field.value as string) || ""}
                        onChange={(e) => field.onChange(e)}
                        id="due_date"
                        name="due_date"
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
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            defaultValue={"baja"}
                            placeholder="Select priority"
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
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
              <DialogFooter>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
