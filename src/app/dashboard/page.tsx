import { redirect } from "next/navigation";
import { readSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewFinance, projectWhereFor, taskWhereFor } from "@/lib/rbac";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export default async function DashboardPage() {
  const user = await readSessionUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [projects, overdue, blocked, dueToday, pendingApprovals, procurement, meetings, activity, finance] =
    await Promise.all([
      prisma.project.count({ where: { AND: [projectWhereFor(user), { status: "ACTIVE" }] } }),
      prisma.task.count({
        where: { AND: [taskWhereFor(user), { dueDate: { lt: now }, status: { notIn: ["DONE", "CANCELLED"] } }] },
      }),
      prisma.task.count({ where: { AND: [taskWhereFor(user), { status: "WAITING" }] } }),
      prisma.task.count({
        where: {
          AND: [
            taskWhereFor(user),
            { dueDate: { gte: startOfToday, lte: endOfToday }, status: { notIn: ["DONE", "CANCELLED"] } },
          ],
        },
      }),
      prisma.task.count({ where: { AND: [taskWhereFor(user), { approvalRequired: true, status: "REVIEW" }] } }),
      prisma.procurementItem.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.meeting.findMany({ where: { scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 5, include: { project: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
      canViewFinance(user)
        ? prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { status: { in: ["PENDING", "APPROVED", "PAID"] } } })
        : Promise.resolve(null),
    ]);

  const cards = [
    { label: "Active projects", value: projects, detail: "In motion across Axis" },
    { label: "Overdue tasks", value: overdue, detail: "Need attention" },
    { label: "Blocked tasks", value: blocked, detail: "Waiting or dependent" },
    { label: "Due today", value: dueToday, detail: "Current workload" },
    { label: "Pending approvals", value: pendingApprovals, detail: "Tasks in review" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">{user.departmentName ?? "Axis"}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Company dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">A live operating view tuned to your role and permissions.</p>
        </div>
        {finance ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Finance summary</p>
            <p className="mt-1 text-xl font-semibold text-blue-950">{formatCurrency(String(finance._sum.amount ?? 0))}</p>
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Project health and office operations</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {procurement.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{item.itemName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.vendor ?? item.category}</p>
                </div>
                <StatusBadge value={item.status} />
              </div>
            ))}
            {procurement.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No procurement items yet.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Upcoming meetings</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="px-5 py-4">
                <p className="text-sm font-medium">{meeting.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(meeting.scheduledAt)}
                  {meeting.project ? ` · ${meeting.project.name}` : ""}
                </p>
              </div>
            ))}
            {meetings.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No upcoming meetings.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">Recent activity</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {activity.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium">{log.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{log.actor?.name ?? "System"} · {log.entityType}</p>
              </div>
              <StatusBadge value={log.action} />
            </div>
          ))}
          {activity.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
