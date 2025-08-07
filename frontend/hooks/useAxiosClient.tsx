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
        }
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          if (!originalRequest.url?.includes("/login")) {
            const refreshResponse = await axiosClient.post("/auth/refresh");
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
