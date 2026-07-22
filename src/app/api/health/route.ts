import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProductionConfigIssues } from "@/lib/env";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function unavailable() {
  return NextResponse.json(
    { status: "unavailable", service: "jys-commerce" },
    { status: 503, headers },
  );
}

export async function GET() {
  if (getProductionConfigIssues().length > 0 || !process.env.DATABASE_URL) {
    return unavailable();
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", service: "jys-commerce" }, { headers });
  } catch {
    // The readiness contract is intentionally generic: dependency names,
    // connection strings, and driver errors must never reach the response.
    return unavailable();
  }
}
