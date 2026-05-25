import { NextResponse } from "next/server";
import { readSessionUser } from "@/lib/auth";
import { getReferenceData } from "@/lib/api-helpers";

export async function GET() {
  const user = await readSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getReferenceData());
}
