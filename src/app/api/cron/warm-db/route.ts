/**
 * Neon cold-start warm-up — spec §11.
 *
 * Fires a SELECT 1 at 07:00 Prague time (05:00 UTC) to ensure the Neon
 * compute is warm ahead of the first morning booking requests.
 * Scheduled once per day via Vercel Cron (vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../db";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.execute(sql`SELECT 1`);
  return NextResponse.json({ ok: true, warmed_at: new Date().toISOString() });
}
