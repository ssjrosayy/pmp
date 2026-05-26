import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const sessionUser = await readSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your current password and a new password of at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    return NextResponse.json({ error: "New password must be different from the current password." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
  });
  await writeAudit({
    actorId: user.id,
    action: ActivityAction.ACCESS_CHANGE,
    entityType: "User",
    entityId: user.id,
    summary: `${user.name} changed their password.`,
  });

  return NextResponse.json({ ok: true });
}
