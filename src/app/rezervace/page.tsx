import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../../lib/auth";
import { db } from "../../../db";
import {
  dk_services,
  dk_locations,
  dk_account_users,
  dk_accounts,
} from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import BookingWizard from "./BookingWizard";

export const dynamic = "force-dynamic";

export default async function RezervacePage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit?next=/rezervace");

  const [membership] = await db
    .select({ account: dk_accounts, role: dk_account_users.role })
    .from(dk_account_users)
    .innerJoin(dk_accounts, eq(dk_accounts.id, dk_account_users.account_id))
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) redirect("/portal/dashboard");

  const services = await db
    .select({
      id: dk_services.id,
      code: dk_services.code,
      name: dk_services.name,
      duration_min: dk_services.duration_min,
      requires_approval: dk_services.requires_approval,
    })
    .from(dk_services)
    .where(
      and(eq(dk_services.active, true), eq(dk_services.bookable_online, true))
    );

  const locations = await db
    .select({
      id: dk_locations.id,
      label: dk_locations.label,
      street: dk_locations.street,
      city: dk_locations.city,
      zip: dk_locations.zip,
      is_default: dk_locations.is_default,
    })
    .from(dk_locations)
    .where(eq(dk_locations.account_id, membership.account.id));

  const isPending = membership.account.status === "pending";

  return (
    <BookingWizard
      services={services}
      locations={locations}
      isPending={isPending}
    />
  );
}
