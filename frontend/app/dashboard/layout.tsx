"use client";
import { useEffect } from "react";
import AuthService from "@/services/authService";
import useAxiosClient from "@/hooks/useAxiosClient";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import { toast } from "sonner";
import { AxiosError } from "axios";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const api = useAxiosClient();
  const authService = new AuthService(api);
  const auth = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Fetch auth user if not exists
    async function fetchUser() {
      if (!auth?.id) {
        try {
          await authService.getUser();
        } catch (e) {
          const AxiosError = e as AxiosError<{ detail?: string }>;
          toast.error(
            AxiosError.response?.data?.detail || "Failed to fetch user"
          );
        }
      }
    }
    fetchUser();
  }, [auth]);

  return <>{children}</>;
}
