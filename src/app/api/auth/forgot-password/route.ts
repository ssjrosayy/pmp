import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (user) {
    await writeAudit({
      actorId: user.id,
      action: ActivityAction.UPDATE,
      entityType: "User",
      entityId: user.id,
      summary: "Password reset requested.",
    });
  }

  return NextResponse.json({
    ok: true,
    message: "If that email exists, a reset workflow can be sent by the configured mail provider.",
  });
}
