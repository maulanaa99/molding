import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, COOKIE_NAME, UserSession } from "@/lib/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewati static assets, api time, api auth, favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/time") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes("favicon.ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  const user = sessionCookie ? verifyToken<UserSession>(sessionCookie) : null;

  // Jika di halaman login
  if (pathname === "/login") {
    if (user) {
      // Sudah login, arahkan ke dashboard utama
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Jika belum login dan mengakses halaman utama atau rute lainnya
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    // Simpan returnUrl jika diperlukan
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Teruskan dengan header identitas user
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", String(user.id));
  requestHeaders.set("x-user-role", user.role);
  requestHeaders.set("x-user-name", encodeURIComponent(user.name));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua path request kecuali yang diawali dengan:
     * - api/time
     * - api/auth
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/time|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
