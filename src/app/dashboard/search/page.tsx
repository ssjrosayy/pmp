import Link from "next/link";
import { redirect } from "next/navigation";
import { readSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewFinance, documentWhereFor, projectWhereFor, taskWhereFor } from "@/lib/rbac";

type SearchProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchProps) {
  const user = await readSessionUser();
  if (!user) redirect("/login");
  const { q = "" } = await searchParams;
  const query = q.trim();

  const contains = { contains: query, mode: "insensitive" as const };
  const [projects, tasks, documents, users, candidates, meetings, expenses] = query
    ? await Promise.all([
        prisma.project.findMany({ where: { AND: [projectWhereFor(user), { OR: [{ name: contains }, { description: contains }, { clientName: contains }] }] }, take: 8 }),
        prisma.task.findMany({ where: { AND: [taskWhereFor(user), { OR: [{ title: contains }, { description: contains }] }] }, take: 8 }),
        prisma.document.findMany({ where: { AND: [documentWhereFor(user), { OR: [{ title: contains }, { content: contains }, { fileName: contains }] }] }, take: 8 }),
        prisma.user.findMany({ where: { OR: [{ name: contains }, { email: contains }] }, take: 8, include: { role: true } }),
        prisma.candidate.findMany({ where: { OR: [{ name: contains }, { roleAppliedFor: contains }, { email: contains }] }, take: 8 }),
        prisma.meeting.findMany({ where: { OR: [{ title: contains }, { agenda: contains }, { notes: contains }] }, take: 8 }),
        canViewFinance(user) ? prisma.expense.findMany({ where: { OR: [{ title: contains }, { category: contains }] }, take: 8 }) : Promise.resolve([]),
      ])
    : [[], [], [], [], [], [], []];

  const groups = [
    { title: "Projects", href: "/dashboard/projects", items: projects, label: "name" },
    { title: "Tasks", href: "/dashboard/tasks", items: tasks, label: "title" },
    { title: "Documents", href: "/dashboard/documents", items: documents, label: "title" },
    { title: "Employees", href: "/dashboard/users", items: users, label: "name" },
    { title: "Candidates", href: "/dashboard/candidates", items: candidates, label: "name" },
    { title: "Meetings", href: "/dashboard/meetings", items: meetings, label: "title" },
    { title: "Expenses", href: "/dashboard/expenses", items: expenses, label: "title" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Global search</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{query ? `Results for "${query}"` : "Search Axis"}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold">{group.title}</h2>
              <Link href={group.href} className="text-sm font-medium text-blue-700">
                Open
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {group.items.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <p className="text-sm font-medium">{String(item[group.label as keyof typeof item])}</p>
                </div>
              ))}
              {group.items.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No matches.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
