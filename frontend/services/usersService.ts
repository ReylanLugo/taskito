import { AppDispatch } from "@/lib/store";
import { deleteUser, setUsers, updateUser, UsersState } from "@/lib/store/slices/users";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { AxiosInstance } from "axios";
import { RootState } from "@/lib/store";
import { User } from "@/types/User";

/**
 * Service class for managing users.
 *
 * This class provides methods to retrieve, update, and delete users, as well as
 * fetch tasks associated with a specific user. It utilizes an Axios instance for
 * making HTTP requests and integrates with a Redux store to manage user state.
 * The CSRF token is automatically included in requests where applicable.
 *
 * @example
 * const usersService = new UsersService(axiosInstance);
 * const users = await usersService.getUsers();
 * console.log(users);
 */
export class UsersService {
  private setUsersState: AppDispatch;
  private csrfToken: string;
  constructor(private api: AxiosInstance) {
    this.setUsersState = useAppDispatch();
    this.csrfToken = useAppSelector((state: RootState) => state.auth.csrfToken);
  }

  /**
   * Fetches a list of users from the server.
   *
   * @returns The HTTP status code of the response.
   * @throws Error if there was an error fetching the users.
   */
  async getUsers() {
    try {
      const response = await this.api.get("/auth/users", {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Users fetched",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      this.setUsersState(setUsers(response.data.users));
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Users fetching failed",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  /**
   * Fetches a list of tasks associated with a specific user.
   *
   * @param id - The ID of the user.
   * @returns The list of tasks associated with the user.
   * @throws Error if there was an error fetching the tasks.
   */
  async getUsersTasks(id: number) {
    try {
      const response = await this.api.get(`/users/${id}/tasks`, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
        },
      });
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "Users tasks fetched",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      return response.data;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "Users tasks fetching failed",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error fetching users:", error);
      throw error;
    }
  }

  /**
   * Deletes a user from the server.
   *
   * @param id - The ID of the user to delete.
   * @returns The HTTP status code of the response.
   * @throws Error if there was an error deleting the user.
   */
  async deleteUser(id: number) {
    try {
      const response = await this.api.delete(`/users/${id}`, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
          "x-csrf-token": this.csrfToken,
        },
      });
      this.setUsersState(deleteUser(id));
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User deleted",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "User deletion failed",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  /**
   * Updates a user on the server.
   *
   * @param id - The ID of the user to update.
   * @param userUpdate - The updated user data.
   * @returns The HTTP status code of the response.
   * @throws Error if there was an error updating the user.
   */
  async updateUser(id: number, userUpdate: Omit<User, "id" | "created_at" | "updated_at">) {
    try {
      const response = await this.api.put(`/users/${id}`, userUpdate, {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
          "x-csrf-token": this.csrfToken,
        },
      });
      this.setUsersState(updateUser(response.data));
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User updated",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      return response.status;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "User updating failed",
          labels: { channel: "users" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error updating user:", error);
      throw error;
    }
  }
}

export default UsersService;
