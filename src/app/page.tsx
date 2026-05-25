import { redirect } from "next/navigation";
import { readSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await readSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
