import { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import StoreProvider from "@/lib/store/Provider";

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
