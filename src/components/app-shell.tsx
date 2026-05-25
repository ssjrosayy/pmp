"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  FileText,
  Gauge,
  IdCard,
  ListChecks,
  LogOut,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRoundSearch,
  Users,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";

type User = {
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  canViewFinance: boolean;
};

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/dashboard/projects", label: "Projects", icon: BriefcaseBusiness },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { href: "/dashboard/departments", label: "Departments", icon: Building2 },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/hr", label: "HR", icon: IdCard, hideFor: ["CLIENT_GUEST"] },
  { href: "/dashboard/candidates", label: "Hiring", icon: UserRoundSearch, hideFor: ["CLIENT_GUEST"] },
  { href: "/dashboard/procurement", label: "Procurement", icon: ShoppingCart, hideFor: ["CLIENT_GUEST"] },
  { href: "/dashboard/expenses", label: "Finance", icon: WalletCards, finance: true },
  { href: "/dashboard/meetings", label: "Meetings", icon: CalendarClock },
  { href: "/dashboard/users", label: "Users", icon: Users, hideFor: ["CLIENT_GUEST"] },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/auditLogs", label: "Audit Logs", icon: ShieldCheck, adminOnly: true },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleNav = nav.filter((item) => {
    if (item.finance && !user.canViewFinance && user.role !== "SUPER_ADMIN") return false;
    if (item.adminOnly && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) return false;
    if (item.hideFor?.includes(user.role)) return false;
    return true;
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">
            AX
          </div>
          <div>
            <p className="text-sm font-semibold leading-5">Axis Ops</p>
            <p className="text-xs text-slate-500">Company command center</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
              <Search className="h-4 w-4" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Search projects, tasks, documents, people, meetings..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const value = event.currentTarget.value.trim();
                    if (value) router.push(`/dashboard/search?q=${encodeURIComponent(value)}`);
                  }
                }}
              />
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-slate-500">{user.roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
