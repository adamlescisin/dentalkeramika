"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Pending = {
  id: string;
  starts_at: string;
  ends_at: string;
  requester_name: string;
  note: string | null;
  created_at: string;
  service_name: string;
  location_label: string;
  location_city: string;
  account_name: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRezervacePage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dk/v1/reservations/pending");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setItems(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm(id: string) {
    setBusy(id);
    const res = await fetch(`/api/dk/v1/reservations/${id}/confirm`, { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.filter((r) => r.id !== id));
    }
    setBusy(null);
  }

  async function reject(id: string) {
    setBusy(id);
    const res = await fetch(`/api/dk/v1/reservations/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((r) => r.id !== id));
      setRejectId(null);
      setRejectReason("");
    }
    setBusy(null);
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <nav
        className="flex items-center justify-between px-6 py-4 border-b bg-white"
        style={{ borderColor: "var(--line)" }}
      >
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

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
            Čekající rezervace
          </h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>
            Rezervace u služeb vyžadujících manuální potvrzení.
          </p>
        </div>

        {loading && (
          <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Načítám…
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Žádné čekající rezervace.
          </div>
        )}

        {items.length > 0 && (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {items.map((r) => (
              <div key={r.id} className="px-5 py-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {r.service_name}
                      <span className="font-normal ml-2" style={{ color: "#6b7f8a" }}>— {r.account_name}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      {fmt(r.starts_at)} · {r.location_label}, {r.location_city}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                      Žadatel: {r.requester_name} · Přijato: {fmt(r.created_at)}
                    </p>
                    {r.note && (
                      <p className="text-xs mt-1 italic" style={{ color: "#4a5f6a" }}>{r.note}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => confirm(r.id)}
                      disabled={busy === r.id}
                      className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-50"
                      style={{ background: "var(--status-confirmed)" }}
                    >
                      Potvrdit
                    </button>
                    <button
                      onClick={() => setRejectId(r.id)}
                      disabled={busy === r.id}
                      className="text-sm font-medium px-4 py-2 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
                    >
                      Odmítnout
                    </button>
                  </div>
                </div>

                {rejectId === r.id && (
                  <div className="flex flex-col gap-2 pt-1">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Důvod odmítnutí (nepovinné)"
                      rows={2}
                      className="w-full text-sm px-3 py-2 rounded-lg border resize-none focus:outline-none focus:ring-2"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reject(r.id)}
                        disabled={busy === r.id}
                        className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-50"
                        style={{ background: "var(--status-cancelled)" }}
                      >
                        Potvrdit odmítnutí
                      </button>
                      <button
                        onClick={() => { setRejectId(null); setRejectReason(""); }}
                        className="text-sm px-4 py-2 rounded-lg border"
                        style={{ borderColor: "var(--line)", color: "#6b7f8a" }}
                      >
                        Zrušit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
