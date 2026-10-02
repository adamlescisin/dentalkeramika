"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "../../_components/AdminShell";

type Account = {
  id: string; name: string; status: string;
  billing_email: string | null; ico: string | null; dic: string | null;
  billing_address: string | null;
  created_at: string; approved_at: string | null;
};

type Member = {
  membership_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
};

type Reservation = {
  id: string; starts_at: string; ends_at: string; status: string;
  requester_name: string; requester_phone: string; note: string | null;
  created_at: string; reschedule_count: number; service_name: string;
  location_label: string; location_city: string; technician_name: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká", confirmed: "Potvrzeno", cancelled: "Zrušeno",
  completed: "Dokončeno", no_show: "Nedostavil se", rejected: "Odmítnuto", rescheduled: "Přeloženo",
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fffbea", color: "#7a5200" }, confirmed: { bg: "#f0faf5", color: "#1a6b3c" },
  cancelled: { bg: "#fff5f5", color: "#7a1a1a" }, completed: { bg: "#f0f4ff", color: "#1a3a7a" },
  no_show: { bg: "#fff5f5", color: "#7a1a1a" }, rejected: { bg: "#fff5f5", color: "#7a1a1a" },
  rescheduled: { bg: "#fffbea", color: "#7a5200" },
};
const ACCOUNT_STATUS_LABELS: Record<string, string> = { pending: "Čeká", active: "Aktivní", suspended: "Pozastaveno" };
const ACCOUNT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fffbea", color: "#7a5200" }, active: { bg: "#f0faf5", color: "#1a6b3c" },
  suspended: { bg: "#fff5f5", color: "#7a1a1a" },
};
const ROLE_LABELS: Record<string, string> = { owner: "Vlastník", booker: "Rezervace", viewer: "Zobrazení" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2";
const inputStyle = { borderColor: "var(--line)", color: "var(--ink)" };
const labelCls = "block text-xs font-medium mb-1";

export default function OrdinaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Edit details form
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", ico: "", dic: "", billing_email: "", billing_address: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Members: inline editing
  const [editingMember, setEditingMember] = useState<string | null>(null); // membership_id
  const [memberEdit, setMemberEdit] = useState({ email: "", role: "" });
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", firstName: "", lastName: "", phone: "", role: "booker" });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [resData, resMembers] = await Promise.all([
        fetch(`/api/dk/v1/admin/accounts/${id}/reservations`),
        fetch(`/api/dk/v1/admin/accounts/${id}/users`),
      ]);
      if (!resData.ok) {
        const b = await resData.json().catch(() => ({}));
        setError((b as { error?: string }).error ?? "Chyba při načítání.");
        return;
      }
      const json = await resData.json();
      setAccount(json.account);
      setReservations(json.data ?? []);
      if (resMembers.ok) {
        const mj = await resMembers.json();
        setMembers(mj.data ?? []);
      }
    } catch { setError("Síťová chyba."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openEdit() {
    if (!account) return;
    setEditForm({
      name: account.name,
      ico: account.ico ?? "",
      dic: account.dic ?? "",
      billing_email: account.billing_email ?? "",
      billing_address: account.billing_address ?? "",
    });
    setEditError(null);
    setShowEdit(true);
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true); setEditError(null);
    const res = await fetch(`/api/dk/v1/admin/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditSaving(false);
    if (res.ok) { setShowEdit(false); await load(); }
    else {
      const b = await res.json().catch(() => ({}));
      setEditError((b as { error?: string }).error ?? "Chyba při ukládání.");
    }
  }

  function openMemberEdit(m: Member) {
    setEditingMember(m.membership_id);
    setMemberEdit({ email: m.email, role: m.role });
    setMemberError(null);
  }

  async function saveMember(userId: string) {
    setMemberSaving(true); setMemberError(null);
    const res = await fetch(`/api/dk/v1/admin/accounts/${id}/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberEdit),
    });
    setMemberSaving(false);
    if (res.ok) { setEditingMember(null); await load(); }
    else {
      const b = await res.json().catch(() => ({}));
      setMemberError((b as { error?: string }).error ?? "Chyba při ukládání.");
    }
  }

  async function removeMember(userId: string) {
    if (!confirm("Opravdu odebrat tohoto uživatele z ordinace?")) return;
    const res = await fetch(`/api/dk/v1/admin/accounts/${id}/users/${userId}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const b = await res.json().catch(() => ({}));
      alert((b as { error?: string }).error ?? "Nepodařilo se odebrat uživatele.");
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true); setAddError(null);
    const res = await fetch(`/api/dk/v1/admin/accounts/${id}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addForm, practiceName: account?.name }),
    });
    setAddSaving(false);
    if (res.ok) {
      setShowAddMember(false);
      setAddForm({ email: "", firstName: "", lastName: "", phone: "", role: "booker" });
      await load();
    } else {
      const b = await res.json().catch(() => ({}));
      setAddError((b as { error?: string }).error ?? "Chyba při přidávání.");
    }
  }

  const filtered = statusFilter === "all" ? reservations : reservations.filter((r) => r.status === statusFilter);
  const statuses = Array.from(new Set(reservations.map((r) => r.status)));

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">

        {/* Practice header */}
        {account && !showEdit && (
          <div className="bg-white rounded-xl border px-6 py-5 flex flex-col gap-1" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>{account.name}</h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={ACCOUNT_STATUS_COLORS[account.status] ?? ACCOUNT_STATUS_COLORS.pending}>
                  {ACCOUNT_STATUS_LABELS[account.status] ?? account.status}
                </span>
              </div>
              <button onClick={openEdit} className="text-xs font-medium px-3 py-1.5 rounded-lg border shrink-0"
                style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}>
                Upravit detail
              </button>
            </div>
            <p className="text-sm" style={{ color: "#6b7f8a" }}>
              {account.billing_email ?? "—"}
              {account.ico && ` · IČO ${account.ico}`}
              {account.dic && ` · DIČ ${account.dic}`}
            </p>
            {account.billing_address && <p className="text-xs" style={{ color: "#9aacb8" }}>{account.billing_address}</p>}
            <p className="text-xs" style={{ color: "#9aacb8" }}>
              Registrováno {new Date(account.created_at).toLocaleDateString("cs-CZ")}
              {account.approved_at && ` · schváleno ${new Date(account.approved_at).toLocaleDateString("cs-CZ")}`}
            </p>
            {reservations.length > 0 && (
              <div className="flex gap-3 mt-3">
                <div className="flex-1 rounded-lg px-4 py-3" style={{ background: "#f0f4ff", border: "1px solid #d0daf8" }}>
                  <p className="text-xs font-medium" style={{ color: "#3a5ab0" }}>Minulé rezervace</p>
                  <p className="text-2xl font-bold mt-0.5" style={{ color: "#1a3a7a" }}>
                    {reservations.filter((r) => new Date(r.starts_at) < new Date()).length}
                  </p>
                </div>
                <div className="flex-1 rounded-lg px-4 py-3" style={{ background: "#f0faf5", border: "1px solid #b8e8d0" }}>
                  <p className="text-xs font-medium" style={{ color: "#1a6b3c" }}>Nadcházející rezervace</p>
                  <p className="text-2xl font-bold mt-0.5" style={{ color: "#0f4a28" }}>
                    {reservations.filter((r) => new Date(r.starts_at) >= new Date()).length}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit details form */}
        {showEdit && account && (
          <form onSubmit={saveDetails} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--line)", background: "var(--porcelain)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Upravit detail ordinace</p>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls} style={{ color: "var(--ink)" }}>Název ordinace *</label>
                  <input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink)" }}>IČO</label>
                  <input value={editForm.ico} onChange={(e) => setEditForm((f) => ({ ...f, ico: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink)" }}>DIČ</label>
                  <input value={editForm.dic} onChange={(e) => setEditForm((f) => ({ ...f, dic: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink)" }}>Fakturační e-mail</label>
                  <input type="email" value={editForm.billing_email} onChange={(e) => setEditForm((f) => ({ ...f, billing_email: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--ink)" }}>Fakturační adresa</label>
                  <input value={editForm.billing_address} onChange={(e) => setEditForm((f) => ({ ...f, billing_address: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>
              {editError && (
                <div className="rounded-lg p-3 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{editError}</div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                <button type="submit" disabled={editSaving}
                  className="text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: "var(--cyan)" }}>
                  {editSaving ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </div>
          </form>
        )}

        {error && (
          <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cyan)" }} />
          </div>
        ) : (
          <>
            {/* Members section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  Uživatelé {members.length > 0 && `(${members.length})`}
                </h2>
                <button onClick={() => { setShowAddMember((v) => !v); setAddError(null); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}>
                  {showAddMember ? "Zavřít" : "+ Přidat uživatele"}
                </button>
              </div>

              {showAddMember && (
                <form onSubmit={addMember} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)", background: "var(--porcelain)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Přidat uživatele</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>Pokud e-mail neexistuje, vytvoří se nový účet s pozvánkou k nastavení hesla.</p>
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className={labelCls} style={{ color: "var(--ink)" }}>E-mail *</label>
                        <input required type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: "var(--ink)" }}>Jméno (pro nový účet)</label>
                        <input value={addForm.firstName} onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                          className={inputCls} style={inputStyle} placeholder="Jan" />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: "var(--ink)" }}>Příjmení (pro nový účet)</label>
                        <input value={addForm.lastName} onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                          className={inputCls} style={inputStyle} placeholder="Novák" />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: "var(--ink)" }}>Telefon</label>
                        <input type="tel" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: "var(--ink)" }}>Role</label>
                        <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                          className={inputCls} style={inputStyle}>
                          <option value="owner">Vlastník</option>
                          <option value="booker">Rezervace</option>
                          <option value="viewer">Zobrazení</option>
                        </select>
                      </div>
                    </div>
                    {addError && (
                      <div className="rounded-lg p-3 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{addError}</div>
                    )}
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setShowAddMember(false)}
                        className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                      <button type="submit" disabled={addSaving}
                        className="text-sm font-semibold px-5 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: "var(--cyan)" }}>
                        {addSaving ? "Přidávám…" : "Přidat"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {members.length === 0 ? (
                <div className="bg-white rounded-xl border p-5 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Žádní uživatelé.</div>
              ) : (
                <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
                  {members.map((m) => (
                    <div key={m.membership_id} className="px-5 py-4 flex flex-col gap-3">
                      {editingMember === m.membership_id ? (
                        <div className="flex flex-col gap-3">
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <label className={labelCls} style={{ color: "var(--ink)" }}>E-mail</label>
                              <input type="email" value={memberEdit.email}
                                onChange={(e) => setMemberEdit((f) => ({ ...f, email: e.target.value }))}
                                className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                              <label className={labelCls} style={{ color: "var(--ink)" }}>Role</label>
                              <select value={memberEdit.role}
                                onChange={(e) => setMemberEdit((f) => ({ ...f, role: e.target.value }))}
                                className={inputCls} style={inputStyle}>
                                <option value="owner">Vlastník</option>
                                <option value="booker">Rezervace</option>
                                <option value="viewer">Zobrazení</option>
                              </select>
                            </div>
                          </div>
                          {memberError && (
                            <div className="rounded-lg p-3 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{memberError}</div>
                          )}
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingMember(null)}
                              className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>Zrušit</button>
                            <button type="button" disabled={memberSaving} onClick={() => saveMember(m.user_id)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: "var(--cyan)" }}>
                              {memberSaving ? "Ukládám…" : "Uložit"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                {m.first_name} {m.last_name}
                              </p>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: m.role === "owner" ? "#f0f4ff" : "#f5f5f5", color: m.role === "owner" ? "#1a3a7a" : "#4a5a66" }}>
                                {ROLE_LABELS[m.role] ?? m.role}
                              </span>
                              {m.status === "invited" && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#fffbea", color: "#7a5200" }}>čeká na přijetí</span>
                              )}
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>{m.email}</p>
                            {m.phone && <p className="text-xs mt-0.5" style={{ color: "#9aacb8" }}>{m.phone}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => openMemberEdit(m)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                              style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}>Upravit</button>
                            <button onClick={() => removeMember(m.user_id)}
                              className="text-xs px-3 py-1.5 rounded-lg border"
                              style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}>Odebrat</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reservations section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  Rezervace{reservations.length > 0 && ` (${reservations.length})`}
                </h2>
                {statuses.length > 1 && (
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    <option value="all">Všechny stavy</option>
                    {statuses.map((s) => (<option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>))}
                  </select>
                )}
              </div>

              {filtered.length === 0 ? (
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
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={colors}>{STATUS_LABELS[r.status] ?? r.status}</span>
                            {r.reschedule_count > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f4ff", color: "#3a5ab0" }}>přeloženo {r.reschedule_count}×</span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: "#6b7f8a" }}>{fmtDate(r.starts_at)} – {fmtTime(r.ends_at)}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>
                            {r.location_label}, {r.location_city}{r.technician_name && ` · ${r.technician_name}`}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#9aacb8" }}>{r.requester_name} · {r.requester_phone}</p>
                          {r.note && <p className="text-xs mt-1 italic" style={{ color: "#9aacb8" }}>„{r.note}"</p>}
                          <p className="text-xs mt-1" style={{ color: "#b0bec5" }}>Podáno {fmtDate(r.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
