import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("taskito_access_token");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  if (!token && isDashboard) {
    return NextResponse.redirect(new URL("/", request.url));
  } else if (token && !isDashboard) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register).*)',
  ],
};