import { RoleName } from "@/lib/enums";
import type { SessionUser } from "@/lib/auth";

export type ModuleKey =
  | "users"
  | "departments"
  | "projects"
  | "tasks"
  | "documents"
  | "hr"
  | "candidates"
  | "procurement"
  | "expenses"
  | "meetings"
  | "notifications"
  | "auditLogs";

const adminRoles = new Set<RoleName>([RoleName.SUPER_ADMIN, RoleName.ADMIN]);
const managerRoles = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.DEPARTMENT_HEAD,
  RoleName.PROJECT_MANAGER,
]);

export function isAdmin(user: SessionUser) {
  return adminRoles.has(user.role);
}

export function isSuperAdmin(user: SessionUser) {
  return user.role === RoleName.SUPER_ADMIN;
}

export function canViewFinance(user: SessionUser) {
  return user.role === RoleName.SUPER_ADMIN || user.canViewFinance;
}

export function canViewSensitiveDocuments(user: SessionUser) {
  return user.role === RoleName.SUPER_ADMIN || user.canViewSensitiveDocuments;
}

export function canReadModule(user: SessionUser, module: ModuleKey) {
  if (module === "expenses") return canViewFinance(user);
  if (module === "auditLogs") return isAdmin(user);
  if (module === "users") return isSuperAdmin(user);
  if (module === "hr" || module === "candidates") {
    return user.role !== RoleName.CLIENT_GUEST;
  }
  return true;
}

export function canWriteModule(user: SessionUser, module: ModuleKey) {
  if (module === "notifications" || module === "auditLogs") return false;
  if (module === "expenses") return canViewFinance(user);
  if (module === "users") return isSuperAdmin(user);
  if (module === "hr") return isAdmin(user);
  if (module === "candidates" || module === "procurement" || module === "departments") {
    return isAdmin(user) || user.role === RoleName.DEPARTMENT_HEAD;
  }
  if (module === "documents") return user.role !== RoleName.CLIENT_GUEST;
  return managerRoles.has(user.role) || module === "tasks";
}

export function projectWhereFor(user: SessionUser) {
  if (isAdmin(user)) return {};
  if (user.role === RoleName.CLIENT_GUEST) {
    return { members: { some: { userId: user.id, access: "client" } } };
  }
  if (user.role === RoleName.DEPARTMENT_HEAD && user.departmentId) {
    return {
      OR: [
        { departmentId: user.departmentId },
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };
  }
  return {
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
  };
}

export function taskWhereFor(user: SessionUser) {
  if (isAdmin(user)) return {};
  if (user.role === RoleName.CLIENT_GUEST) {
    return { project: { members: { some: { userId: user.id, access: "client" } } } };
  }
  if (user.role === RoleName.DEPARTMENT_HEAD && user.departmentId) {
    return {
      OR: [
        { departmentId: user.departmentId },
        { assigneeId: user.id },
        { reporterId: user.id },
        { project: { members: { some: { userId: user.id } } } },
      ],
    };
  }
  return {
    OR: [
      { assigneeId: user.id },
      { reporterId: user.id },
      { project: { members: { some: { userId: user.id } } } },
    ],
  };
}

export function documentWhereFor(user: SessionUser) {
  if (canViewSensitiveDocuments(user)) return {};
  return {
    AND: [
      { sensitive: false },
      {
        OR: [
          { uploaderId: user.id },
          { permissions: { some: { userId: user.id, canRead: true } } },
          { project: projectWhereFor(user) },
        ],
      },
    ],
  };
}
