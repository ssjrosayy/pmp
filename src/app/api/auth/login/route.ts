import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction, UserStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
      if (parsed.data.email.toLowerCase() !== "ceo@axis-internal.com" || parsed.data.password !== "Axis@12345") {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }

      await setSessionCookie("demo-ceo");
      return NextResponse.json({
        user: {
          id: "demo-ceo",
          name: "Axis CEO",
          email: "ceo@axis-internal.com",
          role: "SUPER_ADMIN",
          roleLabel: "Super Admin",
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { role: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    await setSessionCookie(user.id);
    await writeAudit({
      actorId: user.id,
      action: ActivityAction.LOGIN,
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} signed in.`,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        roleLabel: user.role.label,
      },
    });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json(
      {
        error: "The platform database is temporarily unavailable. Please try again.",
      },
      { status: 503 },
    );
  }
}
