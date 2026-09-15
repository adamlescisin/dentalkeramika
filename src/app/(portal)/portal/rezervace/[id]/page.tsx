import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "../../../../../lib/auth";
import { db } from "../../../../../../db";
import {
  dk_reservations,
  dk_services,
  dk_locations,
  dk_account_users,
  dk_reservation_events,
} from "../../../../../../db/schema";
import { eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Čeká na potvrzení", color: "var(--status-pending)" },
  confirmed:   { label: "Potvrzeno",         color: "var(--status-confirmed)" },
  rescheduled: { label: "Přeloženo",         color: "var(--status-pending)" },
  cancelled:   { label: "Zrušeno",           color: "var(--status-cancelled)" },
  completed:   { label: "Uskutečněno",       color: "#6b7f8a" },
  no_show:     { label: "Nedostavil se",     color: "var(--status-cancelled)" },
  rejected:    { label: "Odmítnuto",         color: "var(--status-cancelled)" },
};

function fmt(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return d.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    ...opts,
  });
}

export default async function ReservaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const { id } = await params;

  const [row] = await db
    .select({ reservation: dk_reservations, service: dk_services, location: dk_locations })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .where(eq(dk_reservations.id, id))
    .limit(1);

  if (!row) notFound();

  // Verify user belongs to this account
  const [membership] = await db
    .select()
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.account_id, row.reservation.account_id),
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    )
    .limit(1);

  if (!membership) notFound();

  const events = await db
    .select()
    .from(dk_reservation_events)
    .where(eq(dk_reservation_events.reservation_id, id))
    .orderBy(asc(dk_reservation_events.created_at));

  const { reservation: r, service, location } = row;
  const st = STATUS[r.status] ?? STATUS.pending;
  const now = new Date();
  const canAct = ["pending", "confirmed", "rescheduled"].includes(r.status) &&
    new Date(r.starts_at) > now;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              {service.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6b7f8a" }}>
              Rezervace #{r.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-full shrink-0"
            style={{ background: `${st.color}18`, color: st.color }}
          >
            {st.label}
          </span>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {[
            ["Termín", fmt(new Date(r.starts_at), { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })],
            ["Délka", `${service.duration_min} min`],
            ["Místo", `${location.label} — ${location.street}, ${location.city}`],
            ...(location.access_note ? [["Přístup", location.access_note]] : []),
            ...(r.note ? [["Poznámka", r.note]] : []),
            ["Vytvořeno", fmt(new Date(r.created_at))],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4 px-5 py-3">
              <span className="text-sm w-28 shrink-0 font-medium" style={{ color: "#6b7f8a" }}>{label}</span>
              <span className="text-sm" style={{ color: "var(--ink)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="flex gap-3 flex-wrap">
            <Link
              href={`/portal/rezervace/${r.id}/prelozit`}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border"
              style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
            >
              Přeložit termín
            </Link>
            <a
              href={`/api/dk/v1/reservations/${r.id}/ics`}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              Přidat do kalendáře
            </a>
            <Link
              href={`/portal/rezervace/${r.id}/zrusit`}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border"
              style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
            >
              Zrušit rezervaci
            </Link>
          </div>
        )}

        {/* History */}
        {events.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>Historie</h2>
            <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="text-xs w-36 shrink-0 pt-0.5" style={{ color: "#6b7f8a" }}>
                    {fmt(new Date(ev.created_at))}
                  </span>
                  <span className="text-sm" style={{ color: "var(--ink)" }}>
                    {ev.type === "created" ? "Rezervace vytvořena" :
                     ev.type === "confirmed" ? "Potvrzeno" :
                     ev.type === "rescheduled" ? (() => {
                       try {
                         const to = JSON.parse(ev.to_json ?? "{}");
                         if (to.starts_at) {
                           return `Přeloženo na ${fmt(new Date(to.starts_at), { weekday: "short", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
                         }
                       } catch { /* ignore */ }
                       return "Přeloženo";
                     })() :
                     ev.type === "cancelled" ? "Zrušeno" :
                     ev.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
