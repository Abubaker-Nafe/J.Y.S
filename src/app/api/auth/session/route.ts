import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  let user = null;
  try {
    // Revalidate status, role, and password/profile invalidation against the
    // database instead of trusting possibly stale claims for UI state.
    user = (await requireUser()).user;
  } catch {
    user = null;
  }
  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
