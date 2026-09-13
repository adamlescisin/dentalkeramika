import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_accounts } from "../../../../../../../db/schema";
import { asc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(dk_accounts).orderBy(asc(dk_accounts.created_at));
  return NextResponse.json({ data: rows });
}
