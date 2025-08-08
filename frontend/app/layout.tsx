import { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import StoreProvider from "@/lib/store/Provider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Taskito",
    template: "%s | Taskito",
  },
  description: "Taskito - Task management platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <StoreProvider>
        <Toaster />
        <body className="max-w-screen min-h-screen">{children}</body>
      </StoreProvider>
    </html>
  );
}
