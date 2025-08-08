"use client";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setCsrfToken } from "../lib/store/slices/auth";

/**
 * Custom hook to create and configure an Axios client.
 *
 * The Axios client is configured with a base URL and credentials.
 * It includes response interceptors to handle CSRF tokens for GET requests
 * and to manage authentication token refreshing when a 401 status is encountered.
 *
 * - On GET requests, extracts the CSRF token from response headers and dispatches it to the store.
 * - On 401 error responses, attempts to refresh the authentication token and retries the original request.
 *
 * @returns A configured Axios client instance.
 */
const useAxiosClient = () => {
  const dispatch = useDispatch();
  const axiosClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
  });
  axiosClient.interceptors.response.use(
    (response) => {
      if (response.config.method?.toLowerCase() === "get") {
        console.log(response.headers, "headers");
        const csrfToken = response.headers["x-csrf-token"];
        if (csrfToken) {
          console.log(csrfToken);
          dispatch(setCsrfToken(csrfToken));
          try {
            // Persist token so request interceptor can read it
            localStorage.setItem("csrfToken", csrfToken);
          } catch {}
        }
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const url: string = originalRequest?.url || "";
          const isAuthOrRefresh =
            url.includes("/auth/login") ||
            url.includes("/auth/refresh") ||
            url.includes("/auth/logout");

          // If a logout is in progress, do NOT attempt to refresh
          let logoutGuard = false;
          try {
            const raw = sessionStorage.getItem("logoutInProgressAt");
            if (raw) {
              const ts = parseInt(raw, 10);
              // Consider logout window valid for 7 seconds
              if (!Number.isNaN(ts) && Date.now() - ts < 7000) {
                logoutGuard = true;
              } else {
                sessionStorage.removeItem("logoutInProgressAt");
              }
            }
          } catch {}

          // Only attempt refresh if the failing request is not the login or refresh endpoint
          if (!isAuthOrRefresh && !logoutGuard) {
            const refreshResponse = await axiosClient.post("/auth/refresh");
            console.log(refreshResponse, "refreshResponse");
          }
          return axiosClient(originalRequest);
        } catch (refreshError) {
          window.location.href = "/";
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
  axiosClient.interceptors.request.use(
    (config) => {
      const csrfToken = localStorage.getItem("csrfToken");
      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      }
      return config;
    }
  );

  return axiosClient;
};

export default useAxiosClient;
