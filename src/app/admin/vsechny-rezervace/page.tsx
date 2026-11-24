import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "../../../lib/admin-auth";
import { AdminShell } from "../_components/AdminShell";
import { db } from "../../../../db";
import {
  dk_accounts,
  dk_reservations,
  dk_services,
  dk_locations,
  dk_technicians,
} from "../../../../db/schema";
import { and, asc, desc, eq, gte, lt, ne, type SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Všechny rezervace" };

const LIMIT = 500;

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká na potvrzení",
  confirmed: "Potvrzeno",
  rescheduled: "Přeloženo",
  cancelled: "Zrušeno",
  completed: "Dokončeno",
  no_show: "Nedostavil se",
  rejected: "Odmítnuto",
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fffbea", color: "#7a5200" },
  confirmed: { bg: "#f0faf5", color: "#1a6b3c" },
  rescheduled: { bg: "#e8f6fa", color: "#046B87" },
  cancelled: { bg: "#fff5f5", color: "#7a1a1a" },
  completed: { bg: "#f0f4ff", color: "#1a3a7a" },
  no_show: { bg: "#fff5f5", color: "#7a1a1a" },
  rejected: { bg: "#fff5f5", color: "#7a1a1a" },
};
type ReservationStatus = typeof dk_reservations.$inferSelect.status;

/** UTC instant of 00:00 Europe/Prague on a YYYY-MM-DD date. */
function pragueMidnight(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(utcMidnight.getTime())) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hour12: false }).format(utcMidnight)
  ) % 24;
  return new Date(utcMidnight.getTime() - hour * 3600_000);
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
}

export default async function VsechnyRezervacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/prihlasit");

  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const practice = one("ordinace");
  const status = one("stav") || "active";
  const from = one("od");
  const to = one("do");

  const conditions: SQL[] = [];
  if (practice) conditions.push(eq(dk_reservations.account_id, practice));
  if (status === "active") conditions.push(ne(dk_reservations.status, "cancelled"));
  else if (status !== "all" && status in STATUS_LABELS) conditions.push(eq(dk_reservations.status, status as ReservationStatus));
  const fromDt = from ? pragueMidnight(from) : null;
  const toDt = to ? pragueMidnight(to) : null;
  if (fromDt) conditions.push(gte(dk_reservations.starts_at, fromDt));
  if (toDt) {
    const next = new Date(Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10) + 1)).toISOString().slice(0, 10);
    const endDt = pragueMidnight(next);
    if (endDt) conditions.push(lt(dk_reservations.starts_at, endDt));
  }

  const [accounts, rows] = await Promise.all([
    db.select({ id: dk_accounts.id, name: dk_accounts.name }).from(dk_accounts).orderBy(asc(dk_accounts.name)),
    db
      .select({
        id: dk_reservations.id,
        account_id: dk_reservations.account_id,
        starts_at: dk_reservations.starts_at,
        ends_at: dk_reservations.ends_at,
        status: dk_reservations.status,
        requester_name: dk_reservations.requester_name,
        requester_phone: dk_reservations.requester_phone,
        patient_name: dk_reservations.patient_name,
        note: dk_reservations.note,
        cancel_reason: dk_reservations.cancel_reason,
        reschedule_count: dk_reservations.reschedule_count,
        created_at: dk_reservations.created_at,
        account_name: dk_accounts.name,
        service_name: dk_services.name,
        location_label: dk_locations.label,
        location_street: dk_locations.street,
        location_city: dk_locations.city,
        location_zip: dk_locations.zip,
        technician_name: dk_technicians.display_name,
      })
      .from(dk_reservations)
      .innerJoin(dk_accounts, eq(dk_accounts.id, dk_reservations.account_id))
      .innerJoin(dk_services, eq(dk_services.id, dk_reservations.service_id))
      .innerJoin(dk_locations, eq(dk_locations.id, dk_reservations.location_id))
      .leftJoin(dk_technicians, eq(dk_technicians.id, dk_reservations.technician_id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(fromDt ? asc(dk_reservations.starts_at) : desc(dk_reservations.starts_at))
      .limit(LIMIT + 1),
  ]);

  const truncated = rows.length > LIMIT;
  const list = truncated ? rows.slice(0, LIMIT) : rows;
  const hasFilters = !!(practice || from || to || status !== "active");

  const inputCls = "border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2";
  const inputStyle = { borderColor: "var(--line)", color: "var(--ink)" };
  const labelCls = "text-xs font-medium";

  return (
    <AdminShell>
      <div className="px-6 md:px-8 py-10 flex flex-col gap-6">
        <div>
          <Link href="/admin" className="text-sm" style={{ color: "var(--cyan-deep)" }}>← Zpět na přehled</Link>
          <h1 className="text-2xl font-bold mt-3 mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            Všechny rezervace
          </h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>
            {list.length === 0 ? "Žádné rezervace neodpovídají filtru." : `Zobrazeno ${list.length}${truncated ? ` (prvních ${LIMIT} — zužte filtr)` : ""} rezervací.`}
          </p>
        </div>

        {/* Filters */}
        <form method="GET" className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex flex-col gap-1 min-w-[200px] flex-1">
            <label htmlFor="f-ordinace" className={labelCls} style={{ color: "#6b7f8a" }}>Ordinace</label>
            <select id="f-ordinace" name="ordinace" defaultValue={practice} className={inputCls} style={inputStyle}>
              <option value="">Všechny ordinace</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label htmlFor="f-stav" className={labelCls} style={{ color: "#6b7f8a" }}>Stav</label>
            <select id="f-stav" name="stav" defaultValue={status} className={inputCls} style={inputStyle}>
              <option value="active">Vše kromě zrušených</option>
              <option value="all">Vše včetně zrušených</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-od" className={labelCls} style={{ color: "#6b7f8a" }}>Termín od</label>
            <input id="f-od" type="date" name="od" defaultValue={from} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-do" className={labelCls} style={{ color: "#6b7f8a" }}>Termín do</label>
            <input id="f-do" type="date" name="do" defaultValue={to} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--cyan)" }}>
              Filtrovat
            </button>
            {hasFilters && (
              <Link href="/admin/vsechny-rezervace" className="px-4 py-2 rounded-lg text-sm border bg-white" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
                Zrušit filtry
              </Link>
            )}
          </div>
        </form>

        {/* List */}
        {list.length > 0 && (
          <div className="bg-white rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm" style={{ minWidth: 960 }}>
              <thead>
                <tr className="text-left text-xs uppercase" style={{ color: "#6b7f8a", letterSpacing: "0.05em", background: "var(--porcelain)" }}>
                  <th className="px-4 py-3 font-semibold">Termín</th>
                  <th className="px-4 py-3 font-semibold">Ordinace a adresa</th>
                  <th className="px-4 py-3 font-semibold">Služba / technik</th>
                  <th className="px-4 py-3 font-semibold">Objednal</th>
                  <th className="px-4 py-3 font-semibold">Detaily</th>
                  <th className="px-4 py-3 font-semibold">Stav</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const st = STATUS_COLORS[r.status] ?? { bg: "#f5f5f5", color: "#4a5a66" };
                  const inactive = r.status === "cancelled" || r.status === "rejected";
                  return (
                    <tr key={r.id} className="align-top border-t" style={{ borderColor: "var(--line)", opacity: inactive ? 0.65 : 1 }}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{fmtDay(r.starts_at)}</p>
                        <p className="text-xs tabular-nums" style={{ color: "#6b7f8a" }}>{fmtTime(r.starts_at)}–{fmtTime(r.ends_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/ordinace/${r.account_id}`} className="font-semibold" style={{ color: "var(--cyan-deep)" }}>
                          {r.account_name}
                        </Link>
                        <p className="text-xs" style={{ color: "var(--ink)" }}>{r.location_label}</p>
                        <p className="text-xs" style={{ color: "#6b7f8a" }}>{r.location_street}, {r.location_zip} {r.location_city}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p style={{ color: "var(--ink)" }}>{r.service_name}</p>
                        <p className="text-xs" style={{ color: "#6b7f8a" }}>{r.technician_name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p style={{ color: "var(--ink)" }}>{r.requester_name}</p>
                        <a href={`tel:${r.requester_phone.replace(/\s/g, "")}`} className="text-xs" style={{ color: "var(--cyan-deep)" }}>{r.requester_phone}</a>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#4a5f6a", maxWidth: 280 }}>
                        {r.patient_name && <p>Pacient: <span style={{ color: "var(--ink)" }}>{r.patient_name}</span></p>}
                        {r.note && <p className="break-words">Poznámka: {r.note}</p>}
                        {r.cancel_reason && <p className="break-words" style={{ color: "var(--status-cancelled)" }}>Důvod: {r.cancel_reason}</p>}
                        {r.reschedule_count > 0 && <p>Přeloženo {r.reschedule_count}×</p>}
                        <p style={{ color: "#9aacb8" }}>Vytvořeno {fmtDay(r.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color }}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
