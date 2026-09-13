"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Account = {
  id: string; name: string; status: string;
  billing_email: string | null; ico: string | null;
  created_at: string; approved_at: string | null;
};

type Reservation = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  requester_name: string;
  requester_phone: string;
  note: string | null;
  created_at: string;
  reschedule_count: number;
  service_name: string;
  location_label: string;
  location_city: string;
  technician_name: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Čeká",
  confirmed: "Potvrzeno",
  cancelled: "Zrušeno",
  completed: "Dokončeno",
  no_show:   "Nedostavil se",
  rejected:  "Odmítnuto",
  rescheduled: "Přeloženo",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fffbea", color: "#7a5200" },
  confirmed:   { bg: "#f0faf5", color: "#1a6b3c" },
  cancelled:   { bg: "#fff5f5", color: "#7a1a1a" },
  completed:   { bg: "#f0f4ff", color: "#1a3a7a" },
  no_show:     { bg: "#fff5f5", color: "#7a1a1a" },
  rejected:    { bg: "#fff5f5", color: "#7a1a1a" },
  rescheduled: { bg: "#fffbea", color: "#7a5200" },
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = { pending: "Čeká", active: "Aktivní", suspended: "Pozastaveno" };
const ACCOUNT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#fffbea", color: "#7a5200" },
  active:    { bg: "#f0faf5", color: "#1a6b3c" },
  suspended: { bg: "#fff5f5", color: "#7a1a1a" },
};

function AdminNav({ accountName }: { accountName?: string }) {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
      <Link href="/admin" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>DK Admin</Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/admin/ordinace" style={{ color: "var(--cyan-deep)" }}>← {accountName ? "Ordinace" : "Zpět"}</Link>
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
        </form>
      </div>
    </nav>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

export default function OrdinaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dk/v1/admin/accounts/${id}/reservations`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "Chyba při načítání.");
        return;
      }
      const json = await res.json();
      setAccount(json.account);
      setReservations(json.data ?? []);
    } catch {
      setError("Síťová chyba.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === "all"
    ? reservations
    : reservations.filter((r) => r.status === statusFilter);

  const statuses = Array.from(new Set(reservations.map((r) => r.status)));

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <AdminNav accountName={account?.name} />
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">

        {/* Practice header */}
        {account && (
          <div className="bg-white rounded-xl border px-6 py-5 flex flex-col gap-1" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>{account.name}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={ACCOUNT_STATUS_COLORS[account.status] ?? ACCOUNT_STATUS_COLORS.pending}>
                {ACCOUNT_STATUS_LABELS[account.status] ?? account.status}
              </span>
            </div>
            <p className="text-sm" style={{ color: "#6b7f8a" }}>
              {account.billing_email ?? "—"}
              {account.ico && ` · IČO ${account.ico}`}
            </p>
            <p className="text-xs" style={{ color: "#9aacb8" }}>
              Registrováno {new Date(account.created_at).toLocaleDateString("cs-CZ")}
              {account.approved_at && ` · schváleno ${new Date(account.approved_at).toLocaleDateString("cs-CZ")}`}
            </p>
          </div>
        )}

        {/* Reservations section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              Rezervace{reservations.length > 0 && ` (${reservations.length})`}
            </h2>
            {statuses.length > 1 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                <option value="all">Všechny stavy</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
              {reservations.length === 0 ? "Tato ordinace zatím nemá žádné rezervace." : "Žádné rezervace pro vybraný stav."}
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {filtered.map((r) => {
                const colors = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
                return (
                  <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{r.service_name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={colors}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                        {r.reschedule_count > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4ff", color: "#3a5ab0" }}>
                            přeloženo {r.reschedule_count}×
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "#6b7f8a" }}>
                        {fmtDate(r.starts_at)} – {fmtTime(r.ends_at)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                        {r.location_label}, {r.location_city}
                        {r.technician_name && ` · ${r.technician_name}`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#9aacb8" }}>
                        {r.requester_name} · {r.requester_phone}
                      </p>
                      {r.note && (
                        <p className="text-xs mt-1 italic" style={{ color: "#9aacb8" }}>„{r.note}"</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: "#b0bec5" }}>
                        Podáno {fmtDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
