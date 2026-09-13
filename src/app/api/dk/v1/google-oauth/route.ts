/**
 * Google OAuth2 flow for connecting a technician's Google Calendar.
 *
 * GET  /api/dk/v1/google-oauth?technician_id=…  → redirect to Google consent
 * GET  /api/dk/v1/google-oauth/callback          → exchange code, store tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "../../../../../lib/google-calendar";
import { getSessionFromCookies } from "../../../../../lib/auth";
import { db } from "../../../../../../db";
import { dk_account_users } from "../../../../../../db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.redirect(new URL("/prihlasit", req.url));
  }

  // Only owners can connect a calendar
  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.role, "owner"),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Only account owners can connect a calendar" }, { status: 403 });
  }

  const technicianId = req.nextUrl.searchParams.get("technician_id");
  if (!technicianId) {
    return NextResponse.json({ error: "technician_id required" }, { status: 400 });
  }

  const authUrl = getAuthorizationUrl(technicianId);
  return NextResponse.redirect(authUrl);
}
