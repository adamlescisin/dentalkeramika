"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Service = {
  id: string; code: string; name: string; slug: string; kind: string;
  duration_min: number; buffer_before_min: number; buffer_after_min: number;
  bookable_online: boolean; requires_approval: boolean; active: boolean;
};

type EditState = Partial<Pick<Service, "name" | "slug" | "duration_min" | "buffer_before_min" | "buffer_after_min" | "bookable_online" | "requires_approval" | "active">>;

function AdminNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "var(--line)" }}>
      <Link href="/admin" className="font-bold text-lg" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>DK Admin</Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/admin" style={{ color: "var(--cyan-deep)" }}>← Zpět</Link>
        <form action="/api/dk/v1/auth/logout" method="POST">
          <button type="submit" className="text-sm" style={{ color: "var(--status-cancelled)" }}>Odhlásit</button>
        </form>
      </div>
    </nav>
  );
}

export default function AdminSluzby() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newKind, setNewKind] = useState("scan");
  const [newDuration, setNewDuration] = useState("60");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dk/v1/admin/services");
    const json = await res.json();
    setServices(json.data ?? []);
    setLoading(false);
  }

  async function add() {
    if (!newCode.trim() || !newName.trim() || !newSlug.trim() || !newDuration) return;
    setAdding(true); setError(null);
    const res = await fetch("/api/dk/v1/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode.trim(), name: newName.trim(), slug: newSlug.trim(), kind: newKind, duration_min: Number(newDuration) }),
    });
    if (res.ok) { setNewCode(""); setNewName(""); setNewSlug(""); setNewDuration("60"); await load(); }
    else { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Chyba při přidání."); }
    setAdding(false);
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEditState({ name: s.name, slug: s.slug, duration_min: s.duration_min, buffer_before_min: s.buffer_before_min, buffer_after_min: s.buffer_after_min, bookable_online: s.bookable_online, requires_approval: s.requires_approval, active: s.active });
  }

  async function saveEdit(id: string) {
    setBusy(id); setError(null);
    const res = await fetch(`/api/dk/v1/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editState),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Chyba při uložení."); }
    setEditId(null); await load(); setBusy(null);
  }

  async function toggleFlag(id: string, field: "bookable_online" | "requires_approval" | "active", current: boolean) {
    setBusy(id);
    await fetch(`/api/dk/v1/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !current }),
    });
    await load(); setBusy(null);
  }

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <AdminNav />
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Služby</h1>

        {/* Add form */}
        <div className="bg-white rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: "var(--line)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Přidat službu</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Kód (a/b/c/d)" maxLength={1}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Název"
              className="col-span-2 px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
            <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Slug (url)"
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }}>
              <option value="scan">Scan</option>
              <option value="day_rental">Celodenní</option>
            </select>
            <input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="Délka (min)"
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
          </div>
          <div className="flex justify-end">
            <button onClick={add} disabled={adding || !newCode.trim() || !newName.trim() || !newSlug.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--cyan)" }}>
              Přidat
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>}

        {loading ? (
          <div className="text-sm text-center" style={{ color: "#6b7f8a" }}>Načítám…</div>
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
            {services.length === 0 && <div className="px-5 py-4 text-sm" style={{ color: "#6b7f8a" }}>Žádné služby.</div>}
            {services.map((s) => (
              <div key={s.id} className="px-5 py-4 flex flex-col gap-3">
                {editId === s.id ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <input value={editState.name ?? ""} onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))} placeholder="Název"
                        className="col-span-2 px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
                      <input value={editState.slug ?? ""} onChange={(e) => setEditState((p) => ({ ...p, slug: e.target.value }))} placeholder="Slug"
                        className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
                      <input type="number" value={editState.duration_min ?? ""} onChange={(e) => setEditState((p) => ({ ...p, duration_min: Number(e.target.value) }))} placeholder="Délka (min)"
                        className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
                      <input type="number" value={editState.buffer_before_min ?? ""} onChange={(e) => setEditState((p) => ({ ...p, buffer_before_min: Number(e.target.value) }))} placeholder="Buffer před (min)"
                        className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
                      <input type="number" value={editState.buffer_after_min ?? ""} onChange={(e) => setEditState((p) => ({ ...p, buffer_after_min: Number(e.target.value) }))} placeholder="Buffer po (min)"
                        className="px-3 py-2 rounded-lg border text-sm focus:outline-none" style={{ borderColor: "var(--line)" }} />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {(["bookable_online", "requires_approval", "active"] as const).map((flag) => (
                        <label key={flag} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!!editState[flag]} onChange={(e) => setEditState((p) => ({ ...p, [flag]: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: "var(--cyan)" }} />
                          <span style={{ color: "var(--ink)" }}>{flag === "bookable_online" ? "Online rezervace" : flag === "requires_approval" ? "Vyžaduje schválení" : "Aktivní"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(s.id)} disabled={busy === s.id} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "var(--cyan)" }}>Uložit</button>
                      <button onClick={() => setEditId(null)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-base font-bold w-6 text-center shrink-0" style={{ color: s.active ? "var(--cyan-deep)" : "#b0bec5" }}>{s.code.toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: s.active ? "var(--ink)" : "#9aacb8" }}>{s.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                        {s.kind === "scan" ? "Scan" : "Celodenní"} · {s.duration_min} min
                        {s.buffer_before_min > 0 && ` · +${s.buffer_before_min} min před`}
                        {s.buffer_after_min > 0 && ` · +${s.buffer_after_min} min po`}
                      </p>
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {[
                          { label: "Online rezervace", value: s.bookable_online, field: "bookable_online" as const },
                          { label: "Schválení", value: s.requires_approval, field: "requires_approval" as const },
                        ].map(({ label, value, field }) => (
                          <button key={field} onClick={() => toggleFlag(s.id, field, value)} disabled={busy === s.id}
                            className="text-xs px-2 py-0.5 rounded-full font-medium disabled:opacity-50"
                            style={{ background: value ? "#f0faf5" : "#f5f5f5", color: value ? "#1a6b3c" : "#9aacb8" }}>
                            {label}: {value ? "Ano" : "Ne"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => startEdit(s)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Upravit</button>
                      <button onClick={() => toggleFlag(s.id, "active", s.active)} disabled={busy === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
                        style={{ borderColor: "var(--line)", color: s.active ? "var(--status-cancelled)" : "var(--cyan-deep)" }}>
                        {s.active ? "Deaktivovat" : "Aktivovat"}
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
