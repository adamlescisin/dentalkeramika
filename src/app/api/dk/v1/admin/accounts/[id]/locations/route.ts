import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../../../../db";
import { dk_locations } from "../../../../../../../../../db/schema";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "../../../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const rows = await db.select().from(dk_locations)
    .where(eq(dk_locations.account_id, id))
    .orderBy(asc(dk_locations.created_at));

  return NextResponse.json({ data: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: accountId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { label, street, city, zip, access_note, contact_name, contact_phone } = body;

  if (!label?.trim() || !street?.trim() || !city?.trim() || !zip?.trim()) {
    return NextResponse.json({ error: "Vyplňte popis, ulici, město a PSČ." }, { status: 400 });
  }

  const [loc] = await db.insert(dk_locations).values({
    account_id: accountId,
    label: label.trim(),
    street: street.trim(),
    city: city.trim(),
    zip: zip.trim(),
    access_note: access_note?.trim() || null,
    contact_name: contact_name?.trim() || null,
    contact_phone: contact_phone?.trim() || null,
    is_default: false,
  }).returning();

  return NextResponse.json({ data: loc }, { status: 201 });
}
