import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("taskito_access_token");
  const refresh_token = request.cookies.get("taskito_refresh_token");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  // Bypass middleware for logging endpoint to avoid redirects (used by client logging)
  if (request.nextUrl.pathname.startsWith("/internal/log")) {
    return NextResponse.next();
  }
  if (!token && !refresh_token && isDashboard) {
    return NextResponse.redirect(new URL("/", request.url));
  } else if (token && !isDashboard) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Exclude api, internal (logging), static, images, and auth pages from middleware
  matcher: ["/((?!api|internal|_next/static|_next/image|favicon.ico|login|register).*)"],
};
