import { NextResponse } from "next/server";
import { readSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await readSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
