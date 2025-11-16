import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /chat route (and optionally /api/chat)
  if (pathname.startsWith("/chat") || pathname.startsWith("/api/chat")) {
    const authCookie = request.cookies.get("appula_auth");

    // If no valid auth cookie, redirect to /access
    if (!authCookie || authCookie.value !== "ok") {
      const accessUrl = new URL("/access", request.url);
      return NextResponse.redirect(accessUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    "/chat/:path*",
    "/api/chat/:path*",
    // Exclude static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
