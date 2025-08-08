import { UserCreate, UserLogin } from "@/types/Auth";
import { AxiosError, AxiosInstance } from "axios";
import { toast } from "sonner";
import { AuthState } from "@/lib/store/slices/auth";
import { useAppSelector } from "@/lib/store/hooks";
import { AppDispatch, RootState } from "@/lib/store";
import { useAppDispatch } from "@/lib/store/hooks";
import { setUser } from "@/lib/store/slices/auth";
import { Role } from "@/types/User";

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
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User logged in",
          labels: { channel: "auth" },
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
          message: "User login failed",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error logging in:", error);
      const errorMessage =
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.detail ||
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.error;
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
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User getting",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      return response.data.user;
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "User getting failed",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      window.location.href = "/";
      await this.api.post("/auth/logout");
      console.error("Error getting user:", error);
      const errorMessage =
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.detail ||
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.error;
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
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User registered",
          labels: { channel: "auth" },
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
          message: "User registration failed",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error registering user:", error);
      const errorMessage =
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.detail ||
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.error;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
    }
  }

  /**
   * Log out the current user by clearing local state and making a backend request.
   *
   * This function performs several tasks to ensure a complete logout process:
   * 1. Marks logout in progress by setting a session storage item.
   * 2. Clears locally persisted CSRF token from localStorage.
   * 3. Optimistically clears the user state in the application's auth store.
   * 4. Sends a request to the backend to clear authentication cookies.
   * 5. Forces a hard redirect to the homepage to clear in-memory state and abort in-flight requests.
   * 
   * In case of an error during the logout process, it logs the error and shows a toast message.
   * It ensures a redirect to the homepage even if an error occurs, to avoid leaving the app in a half-logged state.
   */
  async logout() {
    try {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "User logged out",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      // Mark logout in progress for interceptors (short TTL handled there)
      try {
        sessionStorage.setItem("logoutInProgressAt", String(Date.now()));
      } catch {}

      // Clear CSRF token persisted locally so subsequent requests don't attach it
      try {
        localStorage.removeItem("csrfToken");
      } catch {}

      // Optimistically clear user state immediately
      this.setAuthStore(
        setUser({
          id: 0,
          username: "",
          email: "",
          role: Role.USER,
          is_active: false,
          updated_at: "",
          created_at: "",
          csrfToken: "",
        })
      );

      // Request backend to clear cookies
      await this.api.post("/auth/logout");

      // Force a hard redirect to clear any in-memory state and abort in-flight requests
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch (error) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "User logout failed",
          labels: { channel: "auth" },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      console.error("Error logging out:", error);
      const errorMessage =
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.detail ||
        (error as AxiosError<{ detail?: string; error?: string }>).response
          ?.data?.error;
      toast.error(
        errorMessage || "An unexpected error occurred. Please try again."
      );
      // Fallback redirect even on error to avoid leaving the app in a half-logged state
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }
}

export default AuthService;
