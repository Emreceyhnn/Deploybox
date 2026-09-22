import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_ROUTES = ["projects", "playground"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[0] || "";

  // The playground is an internal debug tool (raw Redis/denylist controls,
  // manual orchestrator job triggers) — it must never be reachable in a
  // production build, even by an authenticated real user who stumbles onto
  // the URL. Dev-only, regardless of auth state.
  if (routeSegment === "playground" && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  const isProtectedRoute = PROTECTED_ROUTES.includes(routeSegment);

  if (isProtectedRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.JWT_SECRET,
    });

    if (!token || !token.userId) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(authUrl);
    }

    if (token.jti) {
      const revokedRes = await fetch(new URL("/api/auth/denylist-check", request.url), {
        headers: { "x-jti": token.jti },
      });
      const { isRevoked } = await revokedRes.json();

      if (isRevoked) {
        const authUrl = new URL("/auth", request.url);
        authUrl.searchParams.set("callbackUrl", request.url);
        const response = NextResponse.redirect(authUrl);
        response.cookies.delete("next-auth.session-token");
        response.cookies.delete("__Secure-next-auth.session-token");
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
