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

const EMPTY_FORM = {
  practiceName: "", ico: "", dic: "", billingEmail: "", billingAddress: "",
  firstName: "", lastName: "", email: "", phone: "",
};

export default function AdminOrdinace() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

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

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError(null);
    setFormSuccess(false);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSaving(true); setFormError(null); setFormSuccess(false);
    const res = await fetch("/api/dk/v1/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setFormSaving(false);
    if (res.ok) {
      setFormSuccess(true);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } else {
      const b = await res.json().catch(() => ({}));
      setFormError((b as { error?: string }).error ?? "Nepodařilo se vytvořit ordinaci.");
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2";
  const inputStyle = { borderColor: "var(--line)", color: "var(--ink)" };
  const labelCls = "block text-xs font-medium mb-1";

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Ordinace</h1>
            <p className="text-sm" style={{ color: "#6b7f8a" }}>Schvalování a správa klientských účtů.</p>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(null); setFormSuccess(false); }}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white shrink-0"
            style={{ background: "var(--cyan)" }}
          >
            {showForm ? "Zavřít" : "+ Přidat ordinaci"}
          </button>
        </div>

        {/* ── Onboarding form ── */}
        {showForm && (
          <form onSubmit={handleAddSubmit} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)", background: "var(--porcelain)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Nová ordinace</p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>Účet bude ihned aktivní. Kontaktní osobě přijde e-mail s odkazem pro nastavení hesla.</p>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Practice */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9aacb8" }}>Ordinace</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Název ordinace *</label>
                    <input required value={form.practiceName} onChange={(e) => setField("practiceName", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="MUDr. Novák — stomatologie s.r.o." />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>IČO</label>
                    <input value={form.ico} onChange={(e) => setField("ico", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="12345678" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>DIČ</label>
                    <input value={form.dic} onChange={(e) => setField("dic", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="CZ12345678" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Fakturační e-mail</label>
                    <input type="email" value={form.billingEmail} onChange={(e) => setField("billingEmail", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="faktura@ordinace.cz" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Fakturační adresa</label>
                    <input value={form.billingAddress} onChange={(e) => setField("billingAddress", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="Dlouhá 1, 110 00 Praha 1" />
                  </div>
                </div>
              </div>

              <div className="border-t" style={{ borderColor: "var(--line)" }} />

              {/* Owner contact */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9aacb8" }}>Kontaktní osoba (správce účtu)</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Jméno *</label>
                    <input required value={form.firstName} onChange={(e) => setField("firstName", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="Jan" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Příjmení *</label>
                    <input required value={form.lastName} onChange={(e) => setField("lastName", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="Novák" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>E-mail *</label>
                    <input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="jan.novak@ordinace.cz" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--ink)" }}>Telefon</label>
                    <input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                      className={inputCls} style={inputStyle} placeholder="+420 777 000 000" />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="rounded-lg p-3 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{formError}</div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
                  Zrušit
                </button>
                <button type="submit" disabled={formSaving}
                  className="text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: "var(--cyan)" }}>
                  {formSaving ? "Vytvářím…" : "Vytvořit ordinaci"}
                </button>
              </div>
            </div>
          </form>
        )}

        {formSuccess && (
          <div className="rounded-xl p-4 border text-sm" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
            Ordinace byla úspěšně vytvořena. Kontaktní osoba dostane e-mail s odkazem pro nastavení hesla.
          </div>
        )}

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
