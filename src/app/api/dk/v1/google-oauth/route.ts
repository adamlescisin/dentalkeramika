/**
 * Google OAuth2 flow for connecting a technician's Google Calendar.
 *
 * GET  /api/dk/v1/google-oauth?technician_id=…  → redirect to Google consent
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "../../../../../lib/google-calendar";
import { getAdminSession } from "../../../../../lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(new URL("/admin/prihlasit", req.url));

  const technicianId = req.nextUrl.searchParams.get("technician_id");
  if (!technicianId) {
    return NextResponse.json({ error: "technician_id required" }, { status: 400 });
  }

  const authUrl = getAuthorizationUrl(technicianId);
  return NextResponse.redirect(authUrl);
}
