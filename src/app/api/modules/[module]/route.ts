import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ActivityAction, RoleName, UserStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { readSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { canReadModule, canWriteModule } from "@/lib/rbac";
import { getModuleConfig, writeSchema } from "@/lib/modules";
import {
  accessWhere,
  andWhere,
  assignsSuperAdmin,
  auditAction,
  buildWriteData,
  internalEmailFromUsername,
  relationIncludes,
  sanitizeRecord,
  searchWhere,
} from "@/lib/api-helpers";

type Params = { params: Promise<{ module: string }> };

function delegateFor(delegate: string) {
  return (prisma as unknown as Record<string, unknown>)[delegate] as {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
    delete: (args: unknown) => Promise<Record<string, unknown>>;
  };
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  console.error(fallback, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

async function getContext(params: Promise<{ module: string }>) {
  const user = await readSessionUser();
  const { module } = await params;
  const config = getModuleConfig(module);
  return { user, config };
}

async function userHasLinkedRecords(id: string) {
  const counts = await Promise.all([
    prisma.department.count({ where: { headId: id } }),
    prisma.project.count({ where: { ownerId: id } }),
    prisma.projectMember.count({ where: { userId: id } }),
    prisma.task.count({ where: { OR: [{ assigneeId: id }, { reporterId: id }] } }),
    prisma.comment.count({ where: { authorId: id } }),
    prisma.document.count({ where: { uploaderId: id } }),
    prisma.documentPermission.count({ where: { userId: id } }),
    prisma.hRProfile.count({ where: { userId: id } }),
    prisma.candidate.count({ where: { assignedInterviewerId: id } }),
    prisma.expense.count({ where: { OR: [{ paidById: id }, { approvedById: id }] } }),
    prisma.procurementItem.count({ where: { assignedPersonId: id } }),
    prisma.meeting.count({ where: { organizerId: id } }),
    prisma.meetingParticipant.count({ where: { userId: id } }),
    prisma.notification.count({ where: { userId: id } }),
    prisma.auditLog.count({ where: { actorId: id } }),
  ]);

  return counts.some((count) => count > 0);
}

export async function GET(request: Request, { params }: Params) {
  const { user, config } = await getContext(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  if (!canReadModule(user, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 100);
  const skip = Number(url.searchParams.get("skip") ?? 0);
  const where = andWhere(accessWhere(config.key, user), searchWhere(config.searchFields, query));
  const delegate = delegateFor(config.delegate);

  const [items, total] = await Promise.all([
    delegate.findMany({
      where,
      take,
      skip,
      include: relationIncludes(config.key),
      orderBy: config.defaultSort ?? { createdAt: "desc" },
    }),
    delegate.count({ where }),
  ]);

  return NextResponse.json({
    config,
    items: items.map((item) => sanitizeRecord(item, user)),
    total,
    canWrite: canWriteModule(user, config.key),
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { user, config } = await getContext(params);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
    if (!canWriteModule(user, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = writeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    if (config.key === "users" && !internalEmailFromUsername(parsed.data.username)) {
      return NextResponse.json({ error: "Set a valid username using letters, numbers, dots, hyphens, or underscores." }, { status: 400 });
    }
    if (config.key === "users" && (typeof parsed.data.password !== "string" || parsed.data.password.length < 8)) {
      return NextResponse.json({ error: "Set a temporary password of at least 8 characters." }, { status: 400 });
    }

    const data = await buildWriteData(config, parsed.data, user, true);
    if (user.role !== RoleName.SUPER_ADMIN && (await assignsSuperAdmin(config, data))) {
      return NextResponse.json({ error: "Only super admins can assign projects or tasks to a super admin." }, { status: 403 });
    }
    const item = await delegateFor(config.delegate).create({
      data,
      include: relationIncludes(config.key),
    });

    await writeAudit({
      actorId: user.id,
      action: auditAction(true),
      entityType: config.singular,
      entityId: String(item.id),
      summary: `${user.name} created ${config.singular.toLowerCase()} ${String(item.name ?? item.title ?? item.id)}.`,
    });

    return NextResponse.json({ item: sanitizeRecord(item, user) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create record.");
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { user, config } = await getContext(params);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
    if (!canWriteModule(user, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = writeSchema.safeParse(await request.json());
    if (!parsed.success || typeof parsed.data.id !== "string") {
      return NextResponse.json({ error: "An id is required." }, { status: 400 });
    }
    const data = await buildWriteData(config, parsed.data, user, false);
    delete data.id;
    if (user.role !== RoleName.SUPER_ADMIN && (await assignsSuperAdmin(config, data))) {
      return NextResponse.json({ error: "Only super admins can assign projects or tasks to a super admin." }, { status: 403 });
    }

    const item = await delegateFor(config.delegate).update({
      where: { id: parsed.data.id },
      data,
      include: relationIncludes(config.key),
    });

    await writeAudit({
      actorId: user.id,
      action: ActivityAction.UPDATE,
      entityType: config.singular,
      entityId: String(item.id),
      summary: `${user.name} updated ${config.singular.toLowerCase()} ${String(item.name ?? item.title ?? item.id)}.`,
    });

    return NextResponse.json({ item: sanitizeRecord(item, user) });
  } catch (error) {
    return errorResponse(error, "Unable to update record.");
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { user, config } = await getContext(params);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
    if (config.key !== "users" || !canWriteModule(user, config.key)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = writeSchema.safeParse(await request.json());
    const id = parsed.success ? parsed.data.id : null;
    const action = parsed.success ? parsed.data.action : null;
    const password = parsed.success ? parsed.data.password : null;
    if (typeof id !== "string") {
      return NextResponse.json({ error: "A user id is required." }, { status: 400 });
    }
    if (action === "reactivate") {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

      const item = await prisma.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE },
        include: { role: true, department: true },
      });
      await writeAudit({
        actorId: user.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: config.singular,
        entityId: id,
        summary: `${user.name} reactivated user ${target.name}.`,
      });

      return NextResponse.json({ item: sanitizeRecord(item, user) });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Set a temporary password of at least 8 characters." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    await writeAudit({
      actorId: user.id,
      action: ActivityAction.ACCESS_CHANGE,
      entityType: config.singular,
      entityId: id,
      summary: `${user.name} reset the password for ${target.name}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to reset password.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { user, config } = await getContext(params);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
    if (!canWriteModule(user, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const permanently = url.searchParams.get("permanent") === "true";
    if (!id) return NextResponse.json({ error: "An id is required." }, { status: 400 });
    if (config.key === "users" && id === user.id) {
      return NextResponse.json({ error: permanently ? "You cannot permanently delete your own account." : "You cannot deactivate your own account." }, { status: 400 });
    }
    if (config.key === "users") {
      const target = await prisma.user.findUnique({
        where: { id },
        include: { role: true, department: true },
      });
      if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

      if (target.role.name === RoleName.SUPER_ADMIN) {
        return NextResponse.json(
          { error: "Super admin accounts cannot be deactivated or permanently deleted." },
          { status: 403 },
        );
      }

      if (permanently) {
        if (await userHasLinkedRecords(id)) {
          return NextResponse.json(
            { error: "This account still has linked platform records. Reassign or remove those records before permanently deleting the account." },
            { status: 409 },
          );
        }
        try {
          await prisma.user.delete({ where: { id } });
        } catch {
          return NextResponse.json(
            { error: "This account still has linked platform records. Reassign or remove those records before permanently deleting the account." },
            { status: 409 },
          );
        }
        await writeAudit({
          actorId: user.id,
          action: ActivityAction.DELETE,
          entityType: config.singular,
          entityId: id,
          summary: `${user.name} permanently deleted user ${target.name}.`,
        });

        return NextResponse.json({ ok: true });
      }

      const item = await prisma.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
        include: { role: true, department: true },
      });
      await writeAudit({
        actorId: user.id,
        action: ActivityAction.DEACTIVATE,
        entityType: config.singular,
        entityId: id,
        summary: `${user.name} deactivated user ${item.name}.`,
      });

      return NextResponse.json({ ok: true });
    }

    const item = await delegateFor(config.delegate).delete({ where: { id } });
    await writeAudit({
      actorId: user.id,
      action: ActivityAction.DELETE,
      entityType: config.singular,
      entityId: id,
      summary: `${user.name} deleted ${config.singular.toLowerCase()} ${String(item.name ?? item.title ?? item.id)}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to delete record.");
  }
}
