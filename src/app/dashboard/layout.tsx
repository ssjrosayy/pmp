import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { readSessionUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await readSessionUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
