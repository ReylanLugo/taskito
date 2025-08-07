import { AppDispatch } from "@/lib/store";
import { setUsers, UsersState } from "@/lib/store/slices/users";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { AxiosInstance } from "axios";
import { RootState } from "@/lib/store";

export class UsersService {
  private usersState: UsersState;
  private setUsersState: AppDispatch;
  constructor(private api: AxiosInstance) {
    this.usersState = useAppSelector((state: RootState) => state.users);
    this.setUsersState = useAppDispatch();
  }

  async getUsers() {
    try {
      const response = await this.api.get("/auth/users", {
        headers: {
          "Content-Type": "application/json",
          "no-cache": "true",
        },
      });
      this.setUsersState(setUsers(response.data.users));
      return response.status;
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  }
}

export default UsersService;

