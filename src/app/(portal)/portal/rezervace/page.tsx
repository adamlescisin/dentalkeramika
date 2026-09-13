import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "../../../../lib/auth";
import { db } from "../../../../../db";
import {
  dk_account_users,
  dk_reservations,
  dk_services,
  dk_locations,
} from "../../../../../db/schema";
import { eq, and, asc, desc, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Čeká",      color: "var(--status-pending)" },
  confirmed:   { label: "Potvrzeno", color: "var(--status-confirmed)" },
  rescheduled: { label: "Přeloženo", color: "var(--status-pending)" },
  cancelled:   { label: "Zrušeno",   color: "var(--status-cancelled)" },
  completed:   { label: "Hotovo",    color: "#6b7f8a" },
  no_show:     { label: "Nedostavil", color: "var(--status-cancelled)" },
  rejected:    { label: "Odmítnuto", color: "var(--status-cancelled)" },
};

function fmt(d: Date) {
  return d.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function ReservaceListPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const { scope = "upcoming" } = await searchParams;

  const memberships = await db
    .select({ account_id: dk_account_users.account_id })
    .from(dk_account_users)
    .where(
      and(
        eq(dk_account_users.user_id, session.userId),
        eq(dk_account_users.status, "active")
      )
    );

  if (memberships.length === 0) redirect("/portal/dashboard");

  const accountIds = memberships.map((m) => m.account_id);
  const now = new Date();

  const rows = await db
    .select({ reservation: dk_reservations, service: dk_services, location: dk_locations })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .where(
      and(
        or(...accountIds.map((id) => eq(dk_reservations.account_id, id))),
        scope === "past"
          ? undefined
          : undefined,
      )
    )
    .orderBy(scope === "past" ? desc(dk_reservations.starts_at) : asc(dk_reservations.starts_at))
    .limit(50);

  // Split upcoming vs past after fetch
  const upcoming = rows.filter((r) => new Date(r.reservation.starts_at) >= now);
  const past = rows.filter((r) => new Date(r.reservation.starts_at) < now);
  const list = scope === "past" ? past : upcoming;

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
        <Link href="/" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DentálníKeramika
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/portal/dashboard" style={{ color: "var(--cyan-deep)" }}>Dashboard</Link>
          <form action="/api/dk/v1/auth/logout" method="POST">
            <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            Termíny
          </h1>
          <Link
            href="/rezervace"
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
            style={{ background: "var(--cyan)" }}
          >
            + Nová rezervace
          </Link>
        </div>

        {/* Scope tabs */}
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "#e4ecf0" }}>
          {(["upcoming", "past"] as const).map((s) => (
            <Link
              key={s}
              href={`/portal/rezervace?scope=${s}`}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={{
                background: scope === s ? "#fff" : "transparent",
                color: scope === s ? "var(--ink)" : "#6b7f8a",
                boxShadow: scope === s ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
            >
              {s === "upcoming" ? "Nadcházející" : "Minulé"}
            </Link>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            {scope === "upcoming" ? "Žádné nadcházející termíny." : "Žádné minulé termíny."}
            {scope === "upcoming" && (
              <div className="mt-4">
                <Link href="/rezervace" className="text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: "var(--cyan)" }}>
                  Rezervovat termín
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {list.map(({ reservation: r, service, location }) => {
              const st = STATUS[r.status] ?? STATUS.pending;
              const canAct = ["pending", "confirmed", "rescheduled"].includes(r.status) &&
                new Date(r.starts_at) > now;
              return (
                <div key={r.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                      {service.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      {fmt(new Date(r.starts_at))} · {location.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${st.color}18`, color: st.color }}
                    >
                      {st.label}
                    </span>
                    {canAct && (
                      <div className="flex gap-2">
                        <Link
                          href={`/portal/rezervace/${r.id}/prelozit`}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                          style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
                        >
                          Přeložit
                        </Link>
                        <Link
                          href={`/portal/rezervace/${r.id}/zrusit`}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                          style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
                        >
                          Zrušit
                        </Link>
                      </div>
                    )}
                    <Link
                      href={`/portal/rezervace/${r.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
