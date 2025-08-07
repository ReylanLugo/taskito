import { z } from "zod";

export const TaskPriority = z.enum(["baja", "media", "alta"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(200, "Title must be at most 200 characters")
    .refine((val) => val.trim() !== "", {
      message: "Title cannot be empty",
    }),
  description: z.string().max(1000).optional().nullable(),
  due_date: z.coerce.date().optional().nullable(),
  priority: TaskPriority.default("baja"),
  assigned_to: z.number().int().optional().nullable(),
});

export type CreateTaskSchema = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
    title: z
        .string()
        .min(1, "Title cannot be empty")
        .max(200, "Title must be at most 200 characters")
        .refine((val) => val.trim() !== "", {
            message: "Title cannot be empty",
        }),
    description: z.string().max(1000).optional().nullable(),
    due_date: z.coerce.date().optional().nullable(),
    priority: TaskPriority.default("baja"),
    assigned_to: z.number().int().optional().nullable(),
});

export type UpdateTaskSchema = z.infer<typeof UpdateTaskSchema>;
