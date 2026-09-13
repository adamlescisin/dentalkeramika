import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../db";
import { dk_technicians } from "../../../../../../../../db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const allowed = ["display_name", "active"] as const;
  const patch: Partial<typeof dk_technicians.$inferInsert> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const [updated] = await db.update(dk_technicians).set(patch).where(eq(dk_technicians.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.update(dk_technicians).set({ active: false }).where(eq(dk_technicians.id, id));
  return NextResponse.json({ ok: true });
}
