import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionUser } from "@/lib/auth";
import { canViewFinance, isSuperAdmin, projectWhereFor, taskWhereFor } from "@/lib/rbac";

export async function GET() {
  const user = await readSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const taskWhere = taskWhereFor(user);
  const projectWhere = projectWhereFor(user);

  const [activeProjects, overdueTasks, blockedTasks, dueToday, approvals, procurement, meetings, activity, workload] =
    await Promise.all([
      prisma.project.count({ where: { AND: [projectWhere, { status: "ACTIVE" }] } }),
      prisma.task.count({ where: { AND: [taskWhere, { dueDate: { lt: now }, status: { notIn: ["DONE", "CANCELLED"] } }] } }),
      prisma.task.count({ where: { AND: [taskWhere, { status: "WAITING" }] } }),
      prisma.task.count({ where: { AND: [taskWhere, { dueDate: { lte: todayEnd, gte: new Date(now.toDateString()) }, status: { notIn: ["DONE", "CANCELLED"] } }] } }),
      prisma.task.count({ where: { AND: [taskWhere, { approvalRequired: true, status: "REVIEW" }] } }),
      prisma.procurementItem.groupBy({ by: ["status"], _count: true }),
      prisma.meeting.findMany({ where: { scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 5, include: { project: true } }),
      isSuperAdmin(user)
        ? prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } })
        : Promise.resolve([]),
      prisma.task.groupBy({ by: ["assigneeId"], where: taskWhere, _count: true }),
    ]);

  const finance = canViewFinance(user)
    ? await prisma.expense.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: { in: ["PENDING", "APPROVED", "PAID"] } },
      })
    : null;

  return NextResponse.json({
    activeProjects,
    overdueTasks,
    blockedTasks,
    dueToday,
    approvals,
    procurement,
    meetings,
    activity,
    workload,
    finance,
  });
}
