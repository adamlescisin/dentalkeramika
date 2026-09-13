import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../db";
import { dk_services } from "../../../../../../../db/schema";
import { asc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(dk_services).orderBy(asc(dk_services.code));
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { code, name, slug, kind, duration_min, buffer_before_min = 0, buffer_after_min = 0,
          bookable_online = true, requires_approval = false, active = true } = body;

  if (!code || !name || !slug || !kind || !duration_min) {
    return NextResponse.json({ error: "Vyplňte povinná pole: code, name, slug, kind, duration_min." }, { status: 400 });
  }
  if (!["scan", "day_rental"].includes(kind)) {
    return NextResponse.json({ error: "Neplatný druh služby." }, { status: 400 });
  }

  const [row] = await db
    .insert(dk_services)
    .values({ code, name, slug, kind, duration_min, buffer_before_min, buffer_after_min,
              bookable_online, requires_approval, active })
    .returning();

  return NextResponse.json({ data: row }, { status: 201 });
}
