import { Task } from "./Tasks";

export enum Role {
  ADMIN = "admin",
  USER = "user",
}

export type User = {
  id: number;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserWithStats = {
  user: User;
  tasks: Task[];
  total: number;
  completed: number;
  overdue: number;
};
