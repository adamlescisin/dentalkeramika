"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../_components/AdminShell";

type Account = {
  id: string; name: string; ico: string | null; dic: string | null;
  billing_email: string | null; status: string; created_at: string;
  approved_at: string | null;
};

const STATUS_LABELS: Record<string, string> = { pending: "Čeká", active: "Aktivní", suspended: "Pozastaveno" };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#fffbea", color: "#7a5200" },
  active:    { bg: "#f0faf5", color: "#1a6b3c" },
  suspended: { bg: "#fff5f5", color: "#7a1a1a" },
};

export default function AdminOrdinace() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dk/v1/admin/accounts");
    const json = await res.json();
    setAccounts(json.data ?? []);
    setLoading(false);
  }

  async function setStatus(id: string, status: string) {
    setBusy(id); setError(null);
    const res = await fetch(`/api/dk/v1/admin/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Chyba."); }
    await load(); setBusy(null);
  }

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Ordinace</h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>Schvalování a správa klientských účtů.</p>
        </div>

        {error && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} /></div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Žádné ordinace.</div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {accounts.map((a) => {
              const colors = STATUS_COLORS[a.status] ?? STATUS_COLORS.pending;
              return (
                <div key={a.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{a.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      {a.billing_email ?? "—"}
                      {a.ico && ` · IČO ${a.ico}`}
                      {a.dic && ` · DIČ ${a.dic}`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#9aacb8" }}>
                      Registrováno {new Date(a.created_at).toLocaleDateString("cs-CZ")}
                      {a.approved_at && ` · schváleno ${new Date(a.approved_at).toLocaleDateString("cs-CZ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => router.push(`/admin/ordinace/${a.id}`)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
                    >
                      Detail
                    </button>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={colors}>{STATUS_LABELS[a.status] ?? a.status}</span>
                    {a.status === "pending" && (
                      <button onClick={() => setStatus(a.id, "active")} disabled={busy === a.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--cyan)" }}>
                        Schválit
                      </button>
                    )}
                    {a.status === "active" && (
                      <button onClick={() => setStatus(a.id, "suspended")} disabled={busy === a.id}
                        className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}>
                        Pozastavit
                      </button>
                    )}
                    {a.status === "suspended" && (
                      <button onClick={() => setStatus(a.id, "active")} disabled={busy === a.id}
                        className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}>
                        Obnovit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
