import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "../../../../lib/auth";
import { db } from "../../../../../db";
import {
  dk_users,
  dk_account_users,
  dk_accounts,
  dk_reservations,
  dk_services,
  dk_locations,
} from "../../../../../db/schema";
import { eq, and, gt, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "Čeká na potvrzení", color: "var(--status-pending)" },
  confirmed:   { label: "Potvrzeno",         color: "var(--status-confirmed)" },
  rescheduled: { label: "Přeloženo",         color: "var(--status-pending)" },
  cancelled:   { label: "Zrušeno",           color: "var(--status-cancelled)" },
  completed:   { label: "Uskutečněno",       color: "#6b7f8a" },
};

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/prihlasit");

  const [user] = await db
    .select()
    .from(dk_users)
    .where(eq(dk_users.id, session.userId))
    .limit(1);

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

  if (!membership) {
    return (
      <main className="p-8">
        <p>Nejste přiřazeni k žádnému účtu.</p>
      </main>
    );
  }

  const { account } = membership;
  const isPending = account.status === "pending";

  // Upcoming reservations
  const upcoming = await db
    .select({
      reservation: dk_reservations,
      service: dk_services,
      location: dk_locations,
    })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .where(
      and(
        eq(dk_reservations.account_id, account.id),
        gt(dk_reservations.starts_at, new Date())
      )
    )
    .orderBy(asc(dk_reservations.starts_at))
    .limit(10);

  const nextVisit = upcoming[0];

  function formatPrague(d: Date) {
    return d.toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      {/* Top nav */}
      <nav
        className="flex items-center justify-between px-6 py-4 border-b bg-white"
        style={{ borderColor: "var(--line)" }}
      >
        <Link href="/" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          DentálníKeramika
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: "#6b7f8a" }}>{user?.first_name} {user?.last_name}</span>
          <form action="/api/dk/v1/auth/logout" method="POST">
            <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Pending banner */}
        {isPending && (
          <div className="rounded-xl p-4 border" style={{ background: "#fffbea", borderColor: "#f0d58a", color: "#7a5200" }}>
            <strong>Váš účet čeká na schválení.</strong> Jakmile bude schválen (obvykle tentýž pracovní den), budete moci rezervovat termíny. Máte-li dotazy, napište nám.
          </div>
        )}

        {/* Next visit — the loud element */}
        {nextVisit ? (
          <div
            className="rounded-2xl p-6 border"
            style={{ background: "#fff", borderColor: "var(--line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6b7f8a" }}>
              Nejbližší návštěva
            </p>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <p
                  className="text-5xl font-bold leading-none mb-2"
                  style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}
                >
                  {new Date(nextVisit.reservation.starts_at).toLocaleString("cs-CZ", {
                    timeZone: "Europe/Prague",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="text-base" style={{ color: "#4a5f6a" }}>
                  {new Date(nextVisit.reservation.starts_at).toLocaleString("cs-CZ", {
                    timeZone: "Europe/Prague",
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {nextVisit.service.name}
                </p>
                <p className="text-sm mt-1" style={{ color: "#6b7f8a" }}>
                  {nextVisit.location.label} — {nextVisit.location.street}, {nextVisit.location.city}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/portal/rezervace/${nextVisit.reservation.id}/prelozit`}
                  className="text-sm font-medium px-4 py-2 rounded-lg border"
                  style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
                >
                  Přeložit termín
                </Link>
                <a
                  href={`/api/dk/v1/reservations/${nextVisit.reservation.id}.ics`}
                  className="text-sm font-medium px-4 py-2 rounded-lg border"
                  style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                >
                  Přidat do kalendáře
                </a>
                <Link
                  href={`/portal/rezervace/${nextVisit.reservation.id}/zrusit`}
                  className="text-sm font-medium px-4 py-2 rounded-lg border"
                  style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
                >
                  Zrušit
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 border text-center"
            style={{ background: "#fff", borderColor: "var(--line)" }}
          >
            <p className="text-base mb-4" style={{ color: "#4a5f6a" }}>
              Žádné nadcházející termíny. Rezervujte první sken.
            </p>
            <Link
              href="/rezervace"
              className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg text-white"
              style={{ background: "var(--cyan)" }}
            >
              Rezervovat termín
            </Link>
          </div>
        )}

        {/* Upcoming list */}
        {upcoming.length > 1 && (
          <div>
            <h2 className="text-lg font-bold mb-3" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
              Nadcházející termíny
            </h2>
            <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {upcoming.slice(1).map(({ reservation, service, location }) => {
                const st = STATUS_LABEL[reservation.status] ?? STATUS_LABEL.pending;
                return (
                  <Link
                    key={reservation.id}
                    href={`/portal/rezervace/${reservation.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-[#f8fafb] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {service.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                        {formatPrague(new Date(reservation.starts_at))} · {location.label}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: `${st.color}18`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/rezervace", label: "Nová rezervace" },
            { href: "/portal/rezervace", label: "Všechny termíny" },
            { href: "/portal/profil", label: "Profil ordinace" },
            { href: "/portal/profil#tym", label: "Správa týmu" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-white border rounded-xl px-4 py-4 text-sm font-medium text-center hover:border-[var(--cyan)] transition-colors"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
