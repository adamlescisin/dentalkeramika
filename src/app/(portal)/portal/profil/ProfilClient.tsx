"use client";

import { useState } from "react";

type Account = {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  billing_email: string | null;
  billing_address: string | null;
  status: string;
};

type Location = {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  access_note: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_default: boolean;
};

type TeamMember = {
  id: string;
  role: string;
  status: string;
  email: string;
  first_name: string;
  last_name: string;
  invited_at: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Vlastník",
  booker: "Rezervující",
  viewer: "Čtenář",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Aktivní",
  invited: "Pozván",
  suspended: "Pozastaveno",
};

// ─── Billing section ──────────────────────────────────────────────────────────

function BillingSection({ account, isOwner }: { account: Account; isOwner: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: account.name,
    ico: account.ico ?? "",
    dic: account.dic ?? "",
    billing_email: account.billing_email ?? "",
    billing_address: account.billing_address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/dk/v1/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setEditing(false);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Uložení se nezdařilo.");
    }
  }

  const rows: Array<[string, string]> = [
    ["Název ordinace", form.name],
    ["IČO", form.ico || "—"],
    ["DIČ", form.dic || "—"],
    ["Fakturační e-mail", form.billing_email || "—"],
    ["Fakturační adresa", form.billing_address || "—"],
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Fakturační údaje
        </h2>
        {isOwner && !editing && (
          <button
            onClick={() => { setEditing(true); setSaved(false); }}
            className="text-sm font-medium px-4 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
          >
            Upravit
          </button>
        )}
      </div>

      {saved && (
        <div className="rounded-xl p-3 border text-sm mb-3" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
          Uloženo.
        </div>
      )}

      {editing ? (
        <div className="bg-white rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: "var(--line)" }}>
          {[
            { key: "name", label: "Název ordinace", type: "text" as const },
            { key: "ico", label: "IČO", type: "text" as const },
            { key: "dic", label: "DIČ", type: "text" as const },
            { key: "billing_email", label: "Fakturační e-mail", type: "email" as const },
          ].map(({ key, label, type }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>Fakturační adresa</label>
            <textarea
              rows={3}
              value={form.billing_address}
              onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>
          {error && <p className="text-sm" style={{ color: "var(--status-cancelled)" }}>{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              Zrušit
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ background: "var(--cyan)" }}
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 px-5 py-3">
              <span className="text-sm w-40 shrink-0 font-medium" style={{ color: "#6b7f8a" }}>{label}</span>
              <span className="text-sm" style={{ color: "var(--ink)", whiteSpace: "pre-line" }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Location form ────────────────────────────────────────────────────────────

function LocationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Location>;
  onSave: (loc: Location) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    label: initial?.label ?? "",
    street: initial?.street ?? "",
    city: initial?.city ?? "",
    zip: initial?.zip ?? "",
    access_note: initial?.access_note ?? "",
    contact_name: initial?.contact_name ?? "",
    contact_phone: initial?.contact_phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const url = initial?.id ? `/api/dk/v1/account/locations/${initial.id}` : "/api/dk/v1/account/locations";
    const res = await fetch(url, {
      method: initial?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Chyba."); return; }
    onSave(d.data);
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-xl" style={{ borderColor: "var(--cyan)", background: "#f0fbff" }}>
      {[
        { key: "label", label: "Název místa *", placeholder: "Např. Ordinace Praha 2" },
        { key: "street", label: "Ulice a číslo *", placeholder: "Mánesova 12" },
        { key: "city", label: "Město *", placeholder: "Praha" },
        { key: "zip", label: "PSČ *", placeholder: "120 00" },
        { key: "access_note", label: "Přístupový pokyn", placeholder: "3. patro, zvonek Novák" },
        { key: "contact_name", label: "Kontaktní osoba", placeholder: "Jana Nováková" },
        { key: "contact_phone", label: "Kontaktní telefon", placeholder: "+420 777 888 999" },
      ].map(({ key, label, placeholder }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>{label}</label>
          <input
            type="text"
            value={(form as Record<string, string>)[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 bg-white"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          />
        </div>
      ))}
      {error && <p className="text-sm" style={{ color: "var(--status-cancelled)" }}>{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="text-sm px-4 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
          Zrušit
        </button>
        <button onClick={handleSave} disabled={saving} className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--cyan)" }}>
          {saving ? "Ukládám…" : initial?.id ? "Uložit změny" : "Přidat místo"}
        </button>
      </div>
    </div>
  );
}

// ─── Locations section ────────────────────────────────────────────────────────

function LocationsSection({ initialLocations, isOwner }: { initialLocations: Location[]; isOwner: boolean }) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    const res = await fetch(`/api/dk/v1/account/locations/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setLocations((l) => l.filter((loc) => loc.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "Odstranění se nezdařilo.");
    }
  }

  return (
    <section id="mista">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Místa výkonu
        </h2>
        {isOwner && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium px-4 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
          >
            + Přidat místo
          </button>
        )}
      </div>

      {deleteError && (
        <div className="rounded-xl p-3 border text-sm mb-3" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
          {deleteError}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {adding && (
          <LocationForm
            onSave={(loc) => { setLocations((l) => [...l, loc]); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}

        {locations.map((loc) => (
          editingId === loc.id ? (
            <LocationForm
              key={loc.id}
              initial={loc}
              onSave={(updated) => { setLocations((l) => l.map((x) => x.id === updated.id ? updated : x)); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={loc.id} className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {loc.label}
                    {loc.is_default && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: "#e8f5ff", color: "var(--cyan-deep)" }}>
                        Výchozí
                      </span>
                    )}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "#6b7f8a" }}>
                    {loc.street}, {loc.zip} {loc.city}
                  </p>
                  {loc.access_note && (
                    <p className="text-xs mt-1" style={{ color: "#8ca0aa" }}>{loc.access_note}</p>
                  )}
                  {(loc.contact_name || loc.contact_phone) && (
                    <p className="text-xs mt-0.5" style={{ color: "#8ca0aa" }}>
                      {[loc.contact_name, loc.contact_phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {isOwner && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(loc.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
                    >
                      Upravit
                    </button>
                    {!loc.is_default && (
                      <button
                        onClick={() => handleDelete(loc.id)}
                        disabled={deletingId === loc.id}
                        className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
                        style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
                      >
                        {deletingId === loc.id ? "…" : "Odebrat"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        ))}

        {locations.length === 0 && !adding && (
          <div className="bg-white rounded-xl border p-6 text-center text-sm" style={{ borderColor: "var(--line)", color: "#6b7f8a" }}>
            Zatím žádná místa výkonu.
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Team section ─────────────────────────────────────────────────────────────

function TeamSection({ initialTeam, isOwner }: { initialTeam: TeamMember[]; isOwner: boolean }) {
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<"booker" | "viewer">("booker");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleInvite() {
    setInviting(true);
    setInviteError(null);
    const res = await fetch("/api/dk/v1/account/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        firstName: inviteFirstName || undefined,
        lastName: inviteLastName || undefined,
      }),
    });
    setInviting(false);
    if (res.ok) {
      setInviteSent(true);
      setShowInvite(false);
      setInviteEmail(""); setInviteFirstName(""); setInviteLastName("");
      // Reload team
      const t = await fetch("/api/dk/v1/account/team").then((r) => r.json()).catch(() => ({}));
      if (t.data) setTeam(t.data);
    } else {
      const d = await res.json().catch(() => ({}));
      setInviteError(d.error ?? "Pozvání se nezdařilo.");
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const res = await fetch(`/api/dk/v1/account/team/${id}`, { method: "DELETE" });
    setRemovingId(null);
    if (res.ok) {
      setTeam((t) => t.filter((m) => m.id !== id));
    }
  }

  return (
    <section id="tym">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
          Tým
        </h2>
        {isOwner && !showInvite && (
          <button
            onClick={() => { setShowInvite(true); setInviteSent(false); }}
            className="text-sm font-medium px-4 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)", color: "var(--cyan-deep)" }}
          >
            + Pozvat člena
          </button>
        )}
      </div>

      {inviteSent && (
        <div className="rounded-xl p-3 border text-sm mb-3" style={{ background: "#f0faf5", borderColor: "#52c87a", color: "#1a6b3c" }}>
          Pozvánka odeslána.
        </div>
      )}

      {showInvite && (
        <div className="flex flex-col gap-3 p-4 border rounded-xl mb-3" style={{ borderColor: "var(--cyan)", background: "#f0fbff" }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>Jméno</label>
              <input
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="Jana"
                className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 bg-white"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>Příjmení</label>
              <input
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                placeholder="Nováková"
                className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 bg-white"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>E-mail *</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="jana@ordinace.cz"
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 bg-white"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "booker" | "viewer")}
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 bg-white"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <option value="booker">Rezervující — může vytvářet a spravovat rezervace</option>
              <option value="viewer">Čtenář — pouze zobrazení</option>
            </select>
          </div>
          {inviteError && <p className="text-sm" style={{ color: "var(--status-cancelled)" }}>{inviteError}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowInvite(false); setInviteError(null); }} className="text-sm px-4 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              Zrušit
            </button>
            <button onClick={handleInvite} disabled={inviting || !inviteEmail} className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: "var(--cyan)" }}>
              {inviting ? "Odesílám…" : "Odeslat pozvánku"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {team.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-5 py-3 gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {m.first_name} {m.last_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7f8a" }}>{m.email}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs" style={{ color: "#6b7f8a" }}>
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: m.status === "active" ? "#edf7f3" : "#fffbea",
                  color: m.status === "active" ? "#1a6b3c" : "#7a5200",
                }}
              >
                {STATUS_LABEL[m.status] ?? m.status}
              </span>
              {isOwner && m.role !== "owner" && (
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={removingId === m.id}
                  className="text-xs px-3 py-1 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: "var(--line)", color: "var(--status-cancelled)" }}
                >
                  {removingId === m.id ? "…" : "Odebrat"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfilClient({
  account,
  role,
  locations,
  team,
}: {
  account: Account;
  role: string;
  locations: Location[];
  team: TeamMember[];
}) {
  const isOwner = role === "owner";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-10">
      <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>
        Profil ordinace
      </h1>

      <BillingSection account={account} isOwner={isOwner} />
      <LocationsSection initialLocations={locations} isOwner={isOwner} />
      <TeamSection initialTeam={team} isOwner={isOwner} />
    </div>
  );
}
