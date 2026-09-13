import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_technicians } from "../../../../../../../db/schema";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(dk_technicians).orderBy(asc(dk_technicians.display_name));
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { display_name, active = true } = await req.json().catch(() => ({}));
  if (!display_name?.trim()) return NextResponse.json({ error: "display_name je povinný." }, { status: 400 });

  const [row] = await db
    .insert(dk_technicians)
    .values({ display_name: display_name.trim(), active })
    .returning();

  return NextResponse.json({ data: row }, { status: 201 });
}
