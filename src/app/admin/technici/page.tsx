"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../_components/AdminShell";

type Tech = { id: string; display_name: string; email: string | null; google_calendar_id: string | null; active: boolean };

export default function AdminTechnici() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dk/v1/admin/technicians");
    const json = await res.json();
    setTechs(json.data ?? []);
    setLoading(false);
  }

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/dk/v1/admin/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: newName.trim() }),
    });
    if (res.ok) { setNewName(""); await load(); }
    setAdding(false);
  }

  async function saveEdit(id: string) {
    setBusy(id); setEditError(null);
    const res = await fetch(`/api/dk/v1/admin/technicians/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: editName, email: editEmail }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setEditError((b as { error?: string }).error ?? "Uložení se nezdařilo.");
      setBusy(null);
      return;
    }
    setEditId(null);
    await load();
    setBusy(null);
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(id);
    await fetch(`/api/dk/v1/admin/technicians/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
    setBusy(null);
  }

  return (
    <AdminShell>
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Technici</h1>

        {/* Add form */}
        <div className="bg-white rounded-xl border p-4 flex gap-3" style={{ borderColor: "var(--line)" }}>
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Jméno nového technika"
            className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            onClick={add} disabled={adding || !newName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--cyan)" }}
          >
            Přidat
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-sm" style={{ color: "#6b7f8a" }} role="status"><span className="dk-spinner" />Načítám…</div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {techs.length === 0 && (
              <div className="px-5 py-4 text-sm" style={{ color: "#6b7f8a" }}>Žádní technici.</div>
            )}
            {techs.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                {editId === t.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <input
                        value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder="Jméno"
                        className="flex-1 min-w-[140px] px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
                        autoFocus
                      />
                      <input
                        type="email"
                        value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="E-mail pro notifikace"
                        className="flex-1 min-w-[180px] px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
                      />
                      <button onClick={() => saveEdit(t.id)} disabled={busy === t.id} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--cyan)" }}>{busy === t.id ? "Ukládám…" : "Uložit"}</button>
                      <button onClick={() => { setEditId(null); setEditError(null); }} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                    </div>
                    {editError && <p className="text-xs" style={{ color: "var(--status-cancelled)" }}>{editError}</p>}
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: t.active ? "var(--ink)" : "#9aacb8" }}>{t.display_name}</p>
                      <p className="text-xs truncate" style={{ color: t.email ? "#6b7f8a" : "#c0841a" }}>
                        {t.email ? `E-mail: ${t.email}` : "Bez e-mailu — nedostává notifikace"}
                      </p>
                      {t.google_calendar_id && (
                        <p className="text-xs truncate" style={{ color: "#6b7f8a" }}>Kalendář: {t.google_calendar_id}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                      background: t.active ? "#f0faf5" : "#f5f5f5",
                      color: t.active ? "#1a6b3c" : "#9aacb8",
                    }}>
                      {t.active ? "Aktivní" : "Neaktivní"}
                    </span>
                    <button onClick={() => { setEditId(t.id); setEditName(t.display_name); setEditEmail(t.email ?? ""); setEditError(null); }} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Upravit</button>
                    <button
                      onClick={() => toggleActive(t.id, t.active)} disabled={busy === t.id}
                      className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: "var(--line)", color: t.active ? "var(--status-cancelled)" : "var(--cyan-deep)" }}
                    >
                      {busy === t.id ? "…" : t.active ? "Deaktivovat" : "Aktivovat"}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
