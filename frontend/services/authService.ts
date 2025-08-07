import { UserCreate, UserLogin } from "@/types/Auth";
import { AxiosError, AxiosInstance } from "axios";
import { toast } from "sonner";
import { AuthState } from "@/lib/store/slices/auth";
import { useAppSelector } from "@/lib/store/hooks";
import { AppDispatch, RootState } from "@/lib/store";
import { useAppDispatch } from "@/lib/store/hooks";
import { setUser } from "@/lib/store/slices/auth";

/**
 * Service class for authenticating users.
 *
 * @example
 * const authService = new AuthService(axiosInstance);
 * const user = await authService.login({ username: "john", password: "doe" });
 * console.log(user);
 */
class AuthService {
  private api: AxiosInstance;
  private authStore: AuthState;
  private setAuthStore: AppDispatch;

  constructor(api: AxiosInstance) {
    this.api = api;
    this.authStore = useAppSelector((state: RootState) => state.auth);
    this.setAuthStore = useAppDispatch();
  }

  /**
   * Log in a user with the given credentials.
   * @param user - The user's credentials.
   * @returns The response from the server.
   * @throws AxiosError if there was an error logging in.
   */
  async login(user: UserLogin) {
    try {
      const response = await this.api.post("/auth/login", {
        redirect: false,
        username: user.username,
        password: user.password,
      });
      if (response.status === 200) {
        const user = await this.api.get("/auth/me");
        this.setAuthStore(setUser(user.data.user));
      }
      return response.data;
    } catch (error) {
      console.error("Error logging in:", error);
      const errorMessage = (error as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
    }
  }

  /**
   * Retrieve the current authenticated user's information.
   *
   * @returns The current user's data from the server.
   * @throws AxiosError if there was an error fetching the user data.
   */
  async getUser() {
    try {
      const response = await this.api.get("/auth/me");
      this.setAuthStore(setUser(response.data.user));
      return response.data.user;
    } catch (error) {
      console.error("Error getting user:", error);
      const errorMessage = (error as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
    }
  }

  /**
   * Register a new user, automatically log them in, and retrieve their information.
   * 
   * This method performs the following steps:
   * 1. Registers the user with the provided credentials.
   * 2. Logs the user in using their username and password.
   * 3. Retrieves the current user's information.
   * 
   * @param user - The user's registration details.
   * @returns The HTTP status code from the registration response.
   * @throws AxiosError if there was an error during registration, login, or retrieving user data.
   */
  async register(user: UserCreate) {
    try {
      // 1. Register the user
      const response = await this.api.post("/auth/register", user);
      // 2. Login the user
      await this.login({
        username: user.username,
        password: user.password,
      });
      // 3. Get the user
      await this.getUser();
      return response.status;
    } catch (error) {
      console.error("Error registering user:", error);
      const errorMessage = (error as AxiosError<{ detail?: string }>).response
        ?.data?.detail;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
    }
  }
}

export default AuthService;
