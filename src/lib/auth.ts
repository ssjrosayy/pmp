import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { RoleName, UserStatus } from "@/lib/enums";

const SESSION_COOKIE = "axis_session";
const encoder = new TextEncoder();

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  roleLabel: string;
  departmentId: string | null;
  departmentName: string | null;
  canViewFinance: boolean;
  canViewSensitiveDocuments: boolean;
  salaryVisible: boolean;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be set to at least 24 characters.");
  }
  return encoder.encode(secret);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true, department: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLabel: user.role.label,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
      canViewFinance: user.canViewFinance,
      canViewSensitiveDocuments: user.canViewSensitiveDocuments,
      salaryVisible: user.salaryVisible,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
