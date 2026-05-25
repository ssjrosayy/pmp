import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ActivityAction } from "@/generated/prisma/enums";

type AuditInput = {
  actorId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}
