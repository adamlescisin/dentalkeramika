import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../../db";
import { dk_locations, dk_reservations } from "../../../../../../../../../../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId, locationId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { label, street, city, zip, access_note, contact_name, contact_phone } = body;

  const patch: Partial<typeof dk_locations.$inferInsert> = {};
  if (label !== undefined) {
    if (!label.trim()) return NextResponse.json({ error: "Popis nesmí být prázdný." }, { status: 400 });
    patch.label = label.trim();
  }
  if (street !== undefined) {
    if (!street.trim()) return NextResponse.json({ error: "Ulice nesmí být prázdná." }, { status: 400 });
    patch.street = street.trim();
  }
  if (city !== undefined) {
    if (!city.trim()) return NextResponse.json({ error: "Město nesmí být prázdné." }, { status: 400 });
    patch.city = city.trim();
  }
  if (zip !== undefined) {
    if (!zip.trim()) return NextResponse.json({ error: "PSČ nesmí být prázdné." }, { status: 400 });
    patch.zip = zip.trim();
  }
  if (access_note !== undefined) patch.access_note = access_note.trim() || null;
  if (contact_name !== undefined) patch.contact_name = contact_name.trim() || null;
  if (contact_phone !== undefined) patch.contact_phone = contact_phone.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nic ke změně." }, { status: 400 });
  }

  const [updated] = await db.update(dk_locations)
    .set(patch)
    .where(and(eq(dk_locations.id, locationId), eq(dk_locations.account_id, accountId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId, locationId } = await params;

  const [loc] = await db.select({ id: dk_locations.id })
    .from(dk_locations)
    .where(and(eq(dk_locations.id, locationId), eq(dk_locations.account_id, accountId)))
    .limit(1);

  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [activeRes] = await db.select({ id: dk_reservations.id })
    .from(dk_reservations)
    .where(and(eq(dk_reservations.location_id, locationId), ne(dk_reservations.status, "cancelled")))
    .limit(1);

  if (activeRes) {
    return NextResponse.json(
      { error: "Adresu nelze smazat, má aktivní rezervace. Nejprve je zrušte." },
      { status: 409 }
    );
  }

  await db.delete(dk_locations).where(eq(dk_locations.id, locationId));
  return NextResponse.json({ ok: true });
}
