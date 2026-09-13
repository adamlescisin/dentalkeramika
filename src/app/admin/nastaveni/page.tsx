"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Rules = {
  slot_step_min: number;
  lead_time_hours: number;
  reschedule_cutoff_hours: number;
  max_self_reschedules: number;
  horizon_days: number;
  buffers_inside_working_hours: boolean;
};

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

const FIELDS: { key: keyof Rules; label: string; desc: string; type: "number" | "boolean"; unit?: string }[] = [
  { key: "slot_step_min",                label: "Krok slotu",             desc: "Rozestup mezi nabízenými sloty.",              type: "number",  unit: "min" },
  { key: "lead_time_hours",              label: "Minimální předstih",     desc: "Kolik hodin předem lze rezervovat.",            type: "number",  unit: "h"   },
  { key: "reschedule_cutoff_hours",      label: "Uzávěrka přesunu",       desc: "Do kolika hodin před termínem lze přesunout.", type: "number",  unit: "h"   },
  { key: "max_self_reschedules",         label: "Max. přesuny klientem",  desc: "Kolikrát smí klient přesunout jednu rezervaci.", type: "number"        },
  { key: "horizon_days",                 label: "Horizont nabídky",       desc: "Kolik dní dopředu se zobrazují sloty.",         type: "number",  unit: "dní" },
  { key: "buffers_inside_working_hours", label: "Buffery uvnitř směny",   desc: "Buffer před/po termínu musí být v pracovní době.", type: "boolean"      },
];

export default function AdminNastaveni() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dk/v1/admin/booking-rules");
    const json = await res.json();
    setRules(json.data ?? null);
    setDraft(json.data ?? null);
    setLoading(false);
  }

  function patch(key: keyof Rules, value: number | boolean) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch("/api/dk/v1/admin/booking-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) { const json = await res.json(); setRules(json.data); setSaved(true); }
    else { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Uložení se nezdařilo."); }
    setSaving(false);
  }

  const isDirty = rules && draft && JSON.stringify(rules) !== JSON.stringify(draft);

  return (
    <main style={{ background: "var(--porcelain)", minHeight: "100vh" }}>
      <AdminNav />
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Nastavení</h1>
          <p className="text-sm" style={{ color: "#6b7f8a" }}>Globální pravidla rezervačního systému.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} /></div>
        ) : !draft ? (
          <div className="bg-white rounded-xl border p-6 text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Pravidla nejsou k dispozici.</div>
        ) : (
          <>
            <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {FIELDS.map(({ key, label, desc, type, unit }) => (
                <div key={key} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>{desc}</p>
                  </div>
                  {type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input type="checkbox" checked={!!draft[key]} onChange={(e) => patch(key, e.target.checked)}
                        className="w-5 h-5 rounded" style={{ accentColor: "var(--cyan)" }} />
                      <span className="text-sm" style={{ color: "var(--ink)" }}>{draft[key] ? "Ano" : "Ne"}</span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input type="number" value={draft[key] as number} onChange={(e) => patch(key, Number(e.target.value))} min={0}
                        className="w-20 border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }} />
                      {unit && <span className="text-xs" style={{ color: "#6b7f8a" }}>{unit}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>}
            {saved && <div className="rounded-xl p-4 border text-sm" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>Nastavení uloženo.</div>}

            <div className="flex justify-end">
              <button onClick={save} disabled={saving || !isDirty}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--cyan)" }}>
                {saving ? "Ukládám…" : "Uložit nastavení"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
