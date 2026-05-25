import { NextResponse } from "next/server";
import { ActivityAction } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { canReadModule, canWriteModule } from "@/lib/rbac";
import { getModuleConfig, writeSchema } from "@/lib/modules";
import {
  accessWhere,
  andWhere,
  auditAction,
  buildWriteData,
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

    const data = await buildWriteData(config, parsed.data, user, true);
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

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { user, config } = await getContext(params);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!config) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
    if (!canWriteModule(user, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "An id is required." }, { status: 400 });

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
