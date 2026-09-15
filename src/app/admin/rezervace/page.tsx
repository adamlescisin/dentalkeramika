"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../_components/AdminShell";

type Reservation = {
  id: string; starts_at: string; ends_at: string;
  requester_name: string; note: string | null; created_at: string;
  service_name: string; location_label: string; location_city: string; account_name: string;
};

export default function AdminRezervace() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dk/v1/reservations/pending");
    const json = await res.json();
    setReservations(json.data ?? []);
    setLoading(false);
  }

  async function confirm(id: string) {
    setBusy(id); setError(null);
    const res = await fetch(`/api/dk/v1/reservations/${id}/confirm`, { method: "POST" });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Chyba."); }
    await load(); setBusy(null);
  }

  async function reject(id: string) {
    setBusy(id); setError(null);
    const res = await fetch(`/api/dk/v1/reservations/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Chyba."); }
    setRejectId(null); setRejectReason(""); await load(); setBusy(null);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Čekající rezervace</h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>Potvrzení nebo odmítnutí rezervací čekajících na schválení.</p>
        </div>

        {error && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} /></div>
        ) : reservations.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Žádné čekající rezervace.</div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {reservations.map((r) => (
              <div key={r.id} className="px-5 py-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{r.account_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      {r.service_name} · {r.location_label}, {r.location_city}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      {fmtDate(r.starts_at)} – {new Date(r.ends_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {r.note && <p className="text-xs mt-1 italic" style={{ color: "#9aacb8" }}>„{r.note}"</p>}
                    <p className="text-xs mt-1" style={{ color: "#b0bec5" }}>Podáno {fmtDate(r.created_at)}</p>
                  </div>
                  {rejectId !== r.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => confirm(r.id)} disabled={busy === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--cyan)" }}>
                        Potvrdit
                      </button>
                      <button onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                        className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}>
                        Odmítnout
                      </button>
                    </div>
                  )}
                </div>
                {rejectId === r.id && (
                  <div className="flex flex-col gap-2 bg-[#fff5f5] rounded-lg p-3 border" style={{ borderColor: "#f07a7a" }}>
                    <p className="text-xs font-medium" style={{ color: "#7a1a1a" }}>Důvod odmítnutí (volitelné)</p>
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
                      placeholder="Např. termín není dostupný…"
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none"
                      style={{ borderColor: "#f07a7a", color: "var(--ink)" }} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setRejectId(null); setRejectReason(""); }}
                        className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                      <button onClick={() => reject(r.id)} disabled={busy === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--status-cancelled)" }}>
                        Potvrdit odmítnutí
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
