import bcrypt from "bcryptjs";
import { ActivityAction, RoleName } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { canViewSensitiveDocuments, documentWhereFor, isAdmin, projectWhereFor, taskWhereFor } from "@/lib/rbac";
import type { ModuleConfig, FieldConfig } from "@/lib/modules";

export function relationIncludes(moduleKey: string) {
  switch (moduleKey) {
    case "users":
      return { role: true, department: true };
    case "departments":
      return { head: true, _count: { select: { members: true, projects: true, tasks: true } } };
    case "projects":
      return { owner: true, department: true, _count: { select: { tasks: true, milestones: true, documents: true } } };
    case "tasks":
      return { project: true, assignee: true, reporter: true, department: true, _count: { select: { subtasks: true, comments: true } } };
    case "documents":
      return { uploader: true, project: true, _count: { select: { versions: true, comments: true } } };
    case "hr":
      return { user: { include: { department: true, role: true } }, _count: { select: { documents: true } } };
    case "candidates":
      return { assignedInterviewer: true };
    case "procurement":
      return { assignedPerson: true };
    case "expenses":
      return { project: true, paidBy: true, approvedBy: true };
    case "meetings":
      return { organizer: true, project: true, _count: { select: { participants: true, actionItems: true } } };
    case "notifications":
      return {};
    case "auditLogs":
      return { actor: true };
    default:
      return {};
  }
}

export function accessWhere(moduleKey: string, user: SessionUser) {
  switch (moduleKey) {
    case "projects":
      return projectWhereFor(user);
    case "tasks":
      return taskWhereFor(user);
    case "documents":
      return documentWhereFor(user);
    case "users":
      if (isAdmin(user)) return {};
      if (user.role === RoleName.DEPARTMENT_HEAD && user.departmentId) {
        return { OR: [{ id: user.id }, { departmentId: user.departmentId }] };
      }
      return { id: user.id };
    case "hr":
      if (isAdmin(user)) return {};
      if (user.role === RoleName.DEPARTMENT_HEAD && user.departmentId) {
        return { user: { departmentId: user.departmentId } };
      }
      return { userId: user.id };
    case "notifications":
      return { userId: user.id };
    case "auditLogs":
      return isAdmin(user) ? {} : { id: "__none__" };
    default:
      return {};
  }
}

export function searchWhere(searchFields: string[], query: string) {
  const trimmed = query.trim();
  if (!trimmed) return {};
  return {
    OR: searchFields.map((field) => ({
      [field]: { contains: trimmed, mode: "insensitive" },
    })),
  };
}

export function andWhere(...parts: unknown[]) {
  const filtered = parts.filter((part) => part && Object.keys(part as object).length > 0);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { AND: filtered };
}

function coerceValue(field: FieldConfig, value: unknown) {
  if (value === "" || value === undefined) return null;
  if (field.type === "number" || field.type === "money") return Number(value);
  if (field.type === "boolean") return value === true || value === "true" || value === "on";
  if (field.type === "date" || field.type === "datetime") return value ? new Date(String(value)) : null;
  if (field.type === "tags") {
    if (Array.isArray(value)) return value.map(String);
    return String(value)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return value;
}

export async function buildWriteData(config: ModuleConfig, body: Record<string, unknown>, actor: SessionUser, isCreate: boolean) {
  const data: Record<string, unknown> = {};

  for (const field of config.fields) {
    if (field.name === "password") continue;
    if (!(field.name in body)) continue;
    const value = coerceValue(field, body[field.name]);
    if (value === null && field.required && isCreate) continue;
    data[field.name] = value;
  }

  if (config.key === "users") {
    if (isCreate) {
      data.passwordHash = await bcrypt.hash(String(body.password || "Axis@12345"), 12);
    }
  }

  if (config.key === "tasks" && isCreate) {
    data.reporterId = actor.id;
  }

  if (config.key === "documents" && isCreate) {
    data.uploaderId = actor.id;
    if (!canViewSensitiveDocuments(actor)) {
      data.sensitive = false;
    }
  }

  if (config.key === "notifications" && isCreate) {
    data.userId = actor.id;
  }

  return data;
}

export function sanitizeRecord(record: Record<string, unknown>, user: SessionUser) {
  if ("passwordHash" in record) delete record.passwordHash;

  if ("salaryAmount" in record && !isAdmin(user) && !user.salaryVisible) {
    record.salaryAmount = null;
  }

  if (record.hrProfile && typeof record.hrProfile === "object" && record.hrProfile !== null) {
    const profile = record.hrProfile as Record<string, unknown>;
    if (!isAdmin(user) && !user.salaryVisible) profile.salaryAmount = null;
  }

  return record;
}

export async function getReferenceData() {
  const [roles, users, departments, projects] = await Promise.all([
    prisma.role.findMany({ orderBy: { label: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return { roles, users, departments, projects };
}

export function auditAction(isCreate: boolean) {
  return isCreate ? ActivityAction.CREATE : ActivityAction.UPDATE;
}
