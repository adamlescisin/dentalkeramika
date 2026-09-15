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
  dk_technicians,
} from "../../../../../db/schema";
import { eq, and, gt, asc, notInArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: "Čeká na potvrzení", bg: "#fef3c7", color: "#92400e" },
  confirmed:   { label: "Potvrzeno",         bg: "#d1fae5", color: "#065f46" },
  rescheduled: { label: "Přeloženo",         bg: "#fef3c7", color: "#92400e" },
};

function fmtPrague(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", ...opts });
}

function daysUntilLabel(d: Date): string {
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "dnes";
  if (days === 1) return "zítra";
  if (days <= 4) return `za ${days} dny`;
  return `za ${days} dní`;
}

function upcomingCountLabel(n: number): string {
  if (n === 0) return "žádné nadcházející termíny";
  if (n === 1) return "1 nadcházející termín";
  if (n <= 4) return `${n} nadcházející termíny`;
  return `${n} nadcházejících termínů`;
}

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
      <main className="p-8" style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
        <p style={{ color: "#6b7f8a" }}>Nejste přiřazeni k žádnému účtu.</p>
      </main>
    );
  }

  const { account } = membership;
  const isPending = account.status === "pending";

  const upcoming = await db
    .select({
      reservation: dk_reservations,
      service: dk_services,
      location: dk_locations,
      technician: dk_technicians,
    })
    .from(dk_reservations)
    .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
    .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
    .leftJoin(dk_technicians, eq(dk_technicians.id, dk_reservations.technician_id))
    .where(
      and(
        eq(dk_reservations.account_id, account.id),
        gt(dk_reservations.starts_at, new Date()),
        notInArray(dk_reservations.status, ["cancelled", "completed", "no_show", "rejected"])
      )
    )
    .orderBy(asc(dk_reservations.starts_at))
    .limit(10);

  const next = upcoming[0];
  const rest = upcoming.slice(1);

  return (
    <>
      <style>{`
        .portal-wrap { display: flex; min-height: 100vh; background: var(--porcelain); }

        /* ── Sidebar ── */
        .portal-sidebar {
          width: 240px;
          min-width: 240px;
          background: #fff;
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }
        .sidebar-logo {
          padding: 24px 20px 20px;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
          text-decoration: none;
          border-bottom: 1px solid var(--line);
          display: block;
        }
        .sidebar-section { padding: 12px 0; }
        .sidebar-sep { height: 1px; background: var(--line); margin: 8px 20px; }
        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 20px;
          font-size: 13.5px;
          color: #6b7f8a;
          text-decoration: none;
          border-left: 3px solid transparent;
          transition: background 0.1s, color 0.1s;
          font-weight: 400;
        }
        .nav-item:hover { background: var(--porcelain); color: var(--ink); }
        .nav-item.active {
          border-left-color: var(--cyan);
          background: var(--porcelain);
          color: var(--ink);
          font-weight: 600;
        }
        .nav-badge {
          background: var(--cyan);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 999px;
          min-width: 20px;
          text-align: center;
        }
        .sidebar-bottom {
          margin-top: auto;
          padding: 16px 20px;
          border-top: 1px solid var(--line);
        }
        .sidebar-bottom form button {
          font-size: 13px;
          color: var(--status-cancelled);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        /* ── Main ── */
        .portal-main { flex: 1; min-width: 0; padding: 40px 48px; }
        .portal-greeting-name { font-size: 28px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; line-height: 1.2; margin: 0; }
        .portal-greeting-sub { font-size: 14px; color: #6b7f8a; margin: 4px 0 0; }

        /* ── Next visit card ── */
        .next-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid var(--line);
          overflow: hidden;
          margin-top: 28px;
        }
        .next-card-header {
          background: var(--cyan);
          padding: 11px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .next-card-header-label { color: #fff; font-size: 13px; font-weight: 600; }
        .next-card-header-tech { color: rgba(255,255,255,.85); font-size: 13px; }
        .next-card-body {
          display: flex;
          gap: 0;
          align-items: stretch;
          padding: 0;
        }

        /* Left: date column */
        .next-date-col {
          padding: 24px 24px 24px 24px;
          border-right: 1px solid var(--line);
          min-width: 136px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
        }
        .next-day-num {
          font-size: 60px;
          font-weight: 800;
          line-height: 1;
          color: var(--ink);
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .next-month-text { font-size: 13px; color: #6b7f8a; margin-top: 2px; }
        .next-time { font-size: 17px; font-weight: 700; color: var(--cyan); margin-top: 8px; }

        /* Middle: details column */
        .next-details-col { padding: 24px; flex: 1; min-width: 0; }
        .next-service-name { font-size: 16px; font-weight: 700; color: var(--ink); margin: 0 0 6px; letter-spacing: -0.01em; }
        .next-detail-line { font-size: 13px; color: #6b7f8a; margin: 3px 0; line-height: 1.4; }
        .next-status-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
        .next-status-badge {
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
        }
        .next-buffer-text { font-size: 12px; color: #9aacb8; }

        /* Right: actions column */
        .next-actions-col {
          padding: 24px 20px;
          border-left: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          gap: 8px;
          justify-content: center;
          min-width: 168px;
        }
        .action-btn {
          display: block;
          text-align: center;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--ink);
          text-decoration: none;
          white-space: nowrap;
          transition: border-color 0.1s, background 0.1s;
        }
        .action-btn:hover { border-color: #b0c4cc; background: var(--porcelain); }
        .action-btn-cancel { color: var(--status-cancelled); border-color: #f0c0b8; }
        .action-btn-cancel:hover { border-color: var(--status-cancelled); background: #fff5f5; }
        .action-btn-primary { color: var(--cyan-deep); border-color: #b0dce8; }
        .action-btn-primary:hover { border-color: var(--cyan); background: #f0f9fb; }

        /* ── Rest of upcoming ── */
        .upcoming-section { margin-top: 28px; }
        .upcoming-section-title { font-size: 13px; font-weight: 600; color: #9aacb8; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px; }
        .upcoming-list { background: #fff; border-radius: 12px; border: 1px solid var(--line); overflow: hidden; }
        .upcoming-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          border-bottom: 1px solid var(--line);
          text-decoration: none;
          gap: 12px;
          transition: background 0.1s;
        }
        .upcoming-row:last-child { border-bottom: none; }
        .upcoming-row:hover { background: var(--porcelain); }
        .upcoming-row-name { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .upcoming-row-meta { font-size: 12px; color: #6b7f8a; margin-top: 2px; }
        .upcoming-row-badge {
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Empty state ── */
        .empty-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid var(--line);
          padding: 48px 32px;
          text-align: center;
          margin-top: 28px;
        }
        .empty-card-text { font-size: 15px; color: #6b7f8a; margin-bottom: 20px; }
        .btn-primary {
          display: inline-block;
          background: var(--cyan);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          padding: 10px 22px;
          border-radius: 9px;
          text-decoration: none;
        }

        /* ── Pending banner ── */
        .pending-banner {
          background: #fffbea;
          border: 1px solid #f0d58a;
          color: #7a5200;
          border-radius: 12px;
          padding: 14px 18px;
          font-size: 13.5px;
          line-height: 1.5;
          margin-bottom: 4px;
        }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .portal-wrap { flex-direction: column; }
          .portal-sidebar {
            width: 100%;
            min-width: 0;
            height: auto;
            position: static;
            border-right: none;
            border-bottom: 1px solid var(--line);
            flex-direction: row;
            align-items: center;
            overflow-x: auto;
            overflow-y: visible;
          }
          .sidebar-logo { border-bottom: none; padding: 14px 16px; white-space: nowrap; border-right: 1px solid var(--line); }
          .sidebar-section { display: flex; flex-direction: row; padding: 0; flex-shrink: 0; }
          .sidebar-sep { display: none; }
          .nav-item { padding: 14px 14px; border-left: none; border-bottom: 3px solid transparent; white-space: nowrap; }
          .nav-item.active { border-left-color: transparent; border-bottom-color: var(--cyan); }
          .sidebar-bottom { display: none; }
          .portal-main { padding: 24px 20px; }
          .next-card-body { flex-direction: column; }
          .next-date-col { border-right: none; border-bottom: 1px solid var(--line); min-width: 0; flex-direction: row; align-items: baseline; gap: 12px; padding: 18px 20px; }
          .next-day-num { font-size: 44px; }
          .next-details-col { padding: 18px 20px; }
          .next-actions-col { border-left: none; border-top: 1px solid var(--line); flex-direction: row; flex-wrap: wrap; padding: 14px 20px; min-width: 0; }
          .action-btn { flex: 1; min-width: 120px; }
        }
      `}</style>

      <div className="portal-wrap">

        {/* ── Sidebar ── */}
        <aside className="portal-sidebar">
          <Link href="/" className="sidebar-logo">
            DentálníKeramika
          </Link>
          <div className="sidebar-section">
            <Link href="/portal/dashboard" className="nav-item active">
              Přehled
            </Link>
            <Link href="/portal/rezervace" className="nav-item">
              <span>Rezervace</span>
              {upcoming.length > 0 && (
                <span className="nav-badge">{upcoming.length}</span>
              )}
            </Link>
            <a href="#" className="nav-item">Případy a data</a>
            <a href="#" className="nav-item">Faktury</a>
          </div>
          <div className="sidebar-sep" />
          <div className="sidebar-section">
            <Link href="/portal/profil" className="nav-item">Ordinace a tým</Link>
            <Link href="/portal/profil" className="nav-item">Přihlášení a bezpečnost</Link>
          </div>
          <div className="sidebar-bottom">
            <form action="/api/dk/v1/auth/logout" method="POST">
              <button type="submit">Odhlásit se</button>
            </form>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="portal-main">

          {/* Greeting */}
          <p className="portal-greeting-name">Dobrý den, {user?.first_name}</p>
          <p className="portal-greeting-sub">
            {account.name}
            {upcoming.length > 0 && ` · ${upcomingCountLabel(upcoming.length)}`}
          </p>

          {/* Pending banner */}
          {isPending && (
            <div className="pending-banner" style={{ marginTop: "24px" }}>
              <strong>Váš účet čeká na schválení.</strong> Jakmile bude schválen (obvykle tentýž pracovní den), budete moci rezervovat termíny.
            </div>
          )}

          {/* Next visit card */}
          {next ? (() => {
            const r = next.reservation;
            const starts = new Date(r.starts_at);
            const ends = new Date(r.ends_at);
            const blocksFrom = new Date(r.blocks_from);
            const blocksTo = new Date(r.blocks_to);
            const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.confirmed;
            const canAct = ["pending", "confirmed", "rescheduled"].includes(r.status);
            const dayNum = fmtPrague(starts, { day: "numeric" });
            const monthWeekday = fmtPrague(starts, { month: "long", year: "numeric", weekday: "long" });
            const timeStart = fmtPrague(starts, { hour: "2-digit", minute: "2-digit" });
            const timeEnd = fmtPrague(ends, { hour: "2-digit", minute: "2-digit" });
            const bfStart = fmtPrague(blocksFrom, { hour: "2-digit", minute: "2-digit" });
            const bfEnd = fmtPrague(blocksTo, { hour: "2-digit", minute: "2-digit" });
            const hasBuffer = bfStart !== timeStart || bfEnd !== timeEnd;

            return (
              <div className="next-card">
                <div className="next-card-header">
                  <span className="next-card-header-label">
                    Nejbližší výjezd — {daysUntilLabel(starts)}
                  </span>
                  {next.technician && (
                    <span className="next-card-header-tech">
                      Technik: {next.technician.display_name}
                    </span>
                  )}
                </div>
                <div className="next-card-body">
                  {/* Date */}
                  <div className="next-date-col">
                    <div className="next-day-num">{dayNum}</div>
                    <div>
                      <div className="next-month-text">{monthWeekday}</div>
                      <div className="next-time">{timeStart} – {timeEnd}</div>
                    </div>
                  </div>
                  {/* Details */}
                  <div className="next-details-col">
                    <p className="next-service-name">
                      {next.service.name} — {next.location.label}
                    </p>
                    <p className="next-detail-line">
                      {next.location.street}, {next.location.zip} {next.location.city}
                      {next.location.access_note && ` · ${next.location.access_note}`}
                    </p>
                    <p className="next-detail-line">
                      Objednal: {r.requester_name} · {r.requester_phone}
                    </p>
                    {r.patient_name && (
                      <p className="next-detail-line">Pacient: {r.patient_name}</p>
                    )}
                    {r.note && (
                      <p className="next-detail-line">Poznámka: {r.note}</p>
                    )}
                    <div className="next-status-row">
                      <span
                        className="next-status-badge"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      {hasBuffer && (
                        <span className="next-buffer-text">
                          technik blokován {bfStart} – {bfEnd}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  {canAct && (
                    <div className="next-actions-col">
                      <Link href={`/portal/rezervace/${r.id}/prelozit`} className="action-btn action-btn-primary">
                        Přeložit termín
                      </Link>
                      <a href={`/api/dk/v1/reservations/${r.id}/ics`} className="action-btn">
                        Přidat do kalendáře
                      </a>
                      <Link href={`/portal/rezervace/${r.id}/zrusit`} className="action-btn action-btn-cancel">
                        Zrušit
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="empty-card">
              <p className="empty-card-text">Žádné nadcházející termíny. Rezervujte první sken.</p>
              <Link href="/rezervace" className="btn-primary">Rezervovat termín</Link>
            </div>
          )}

          {/* Rest of upcoming */}
          {rest.length > 0 && (
            <div className="upcoming-section">
              <p className="upcoming-section-title">Další termíny</p>
              <div className="upcoming-list">
                {rest.map(({ reservation: r, service, location }) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.confirmed;
                  const starts = new Date(r.starts_at);
                  return (
                    <Link
                      key={r.id}
                      href={`/portal/rezervace/${r.id}`}
                      className="upcoming-row"
                    >
                      <div style={{ minWidth: 0 }}>
                        <p className="upcoming-row-name">{service.name}</p>
                        <p className="upcoming-row-meta">
                          {fmtPrague(starts, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{location.label}
                        </p>
                      </div>
                      <span
                        className="upcoming-row-badge"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
