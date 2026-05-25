import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "axis_session";

const protectedRoutes = ["/dashboard"];

export async function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Missing JWT_SECRET");
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
