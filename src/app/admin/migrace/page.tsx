"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "../_components/AdminShell";
import {
  addressKey,
  legacyCustomerKey,
  mapLegacyStatus,
  parseLegacyCsv,
  pragueLocalToUtc,
  type DkStatus,
  type ImportResult,
  type ImportRow,
  type LegacyRow,
  type ParseResult,
} from "../../../lib/legacy-csv";

// ─── Types (shape of /api/dk/v1/admin/migration/context) ─────────────────────

type CtxUser = {
  id: string; email: string; name: string; phone: string | null; isAdmin: boolean;
  accounts: { id: string; name: string; role: string }[];
};
type CtxLocation = { id: string; account_id: string; label: string; street: string; city: string; zip: string; is_default: boolean };
type CtxAccount = { id: string; name: string; status: string; defaultLocationId: string | null; locations: CtxLocation[] };
type CtxService = { id: string; code: string; name: string; duration_min: number; active: boolean };
type CtxTechnician = { id: string; display_name: string; active: boolean; has_calendar: boolean };
type Ctx = {
  now: string;
  users: CtxUser[];
  accounts: CtxAccount[];
  services: CtxService[];
  technicians: CtxTechnician[];
  defaultTechnicianId: string | null;
  mappings: { customer: Record<string, { userId: string; accountId: string | null }>; service: Record<string, string> };
  migrated: Record<string, { reservationId: string; startsAt: string; status: string; accountName: string }>;
};

type MatchSource = "saved" | "email" | "phone" | "manual" | "none";
type CustomerMapping = { userId: string; accountId: string; source: MatchSource };
type RowOverride = Partial<{ userId: string; accountId: string; locationId: string; serviceId: string; status: DkStatus | ""; include: boolean }>;
type RowState = "ready" | "migrated" | "problem" | "excluded";

type Effective = {
  row: LegacyRow;
  key: string;
  userId: string;
  accountId: string;
  locationId: string;
  serviceId: string;
  status: DkStatus | "";
  include: boolean;
  userOverridden: boolean;
  migrated: Ctx["migrated"][string] | undefined;
  movedInLegacy: boolean;
  problems: string[];
  state: RowState;
};

const STATUS_LABEL: Record<DkStatus, string> = {
  pending: "Čeká na schválení",
  confirmed: "Potvrzeno",
  completed: "Dokončeno",
  cancelled: "Zrušeno",
  rejected: "Zamítnuto",
};
const SOURCE_LABEL: Record<MatchSource, { text: string; bg: string; color: string }> = {
  saved:  { text: "Uloženo z minula", bg: "#eef6ff", color: "#1a4a7a" },
  email:  { text: "Shoda e-mailu",   bg: "#f0faf5", color: "#1a6b3c" },
  phone:  { text: "Dle telefonu — ověřte", bg: "#fffbea", color: "#7a5200" },
  manual: { text: "Ručně",            bg: "#f3f0ff", color: "#4a2a8a" },
  none:   { text: "Nenalezeno",       bg: "#fff5f5", color: "#7a1a1a" },
};
const STATE_BADGE: Record<RowState, { text: string; bg: string; color: string }> = {
  ready:    { text: "K importu",     bg: "#f0faf5", color: "#1a6b3c" },
  migrated: { text: "Již migrováno", bg: "#eef1f3", color: "#4a5a64" },
  problem:  { text: "Problém",       bg: "#fff5f5", color: "#7a1a1a" },
  excluded: { text: "Vynecháno",     bg: "#eef1f3", color: "#4a5a64" },
};
const OUTCOME_BADGE: Record<string, { text: string; bg: string; color: string }> = {
  imported:         { text: "Importováno",      bg: "#f0faf5", color: "#1a6b3c" },
  would_import:     { text: "Bude importováno", bg: "#f0faf5", color: "#1a6b3c" },
  skipped_existing: { text: "Již migrováno",    bg: "#eef1f3", color: "#4a5a64" },
  error:            { text: "Chyba",            bg: "#fff5f5", color: "#7a1a1a" },
  problem:          { text: "Nepřiřazeno",      bg: "#fff5f5", color: "#7a1a1a" },
  excluded:         { text: "Vynecháno",        bg: "#eef1f3", color: "#4a5a64" },
  not_run:          { text: "Nezpracováno",     bg: "#fffbea", color: "#7a5200" },
};

const CHUNK = 25;
const PAGE = 100;
const BORDER = { borderColor: "var(--line)" } as const;
const MUTED = { color: "#6b7f8a" } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const phoneKey = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-9);

function fmtLocal(local: string) {
  const [d, t] = local.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  return `${day}. ${m}. ${y} ${t}`;
}
function fmtIso(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function normName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function Badge({ b }: { b: { text: string; bg: string; color: string } }) {
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: b.bg, color: b.color }}>{b.text}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminMigrace() {
  const [step, setStep] = useState<"upload" | "map" | "review" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  /** Reference time for "past reservation" decisions, captured when the context loads. */
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [technicianId, setTechnicianId] = useState("");
  const [markPastCompleted, setMarkPastCompleted] = useState(true);
  const [remember, setRemember] = useState(true);
  const [serviceMap, setServiceMap] = useState<Record<string, string>>({});
  const [customerMap, setCustomerMap] = useState<Record<string, CustomerMapping>>({});
  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [filter, setFilter] = useState<"all" | RowState>("all");
  const [page, setPage] = useState(0);
  const [customerFilter, setCustomerFilter] = useState<"all" | "attention">("all");

  const [dryResults, setDryResults] = useState<ImportResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finalResults, setFinalResults] = useState<Map<number, ImportResult> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ─── Lookups ────────────────────────────────────────────────────────────────
  const userById = useMemo(() => new Map((ctx?.users ?? []).map((u) => [u.id, u])), [ctx]);
  const accountById = useMemo(() => new Map((ctx?.accounts ?? []).map((a) => [a.id, a])), [ctx]);
  const serviceById = useMemo(() => new Map((ctx?.services ?? []).map((s) => [s.id, s])), [ctx]);
  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);

  const customers = useMemo(() => {
    const m = new Map<string, { key: string; email: string; names: Set<string>; phones: Set<string>; rows: LegacyRow[] }>();
    for (const r of rows) {
      const key = legacyCustomerKey(r);
      if (!m.has(key)) m.set(key, { key, email: r.customerEmail, names: new Set(), phones: new Set(), rows: [] });
      const c = m.get(key)!;
      if (r.customerName) c.names.add(r.customerName);
      if (r.customerPhone) c.phones.add(r.customerPhone);
      c.rows.push(r);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const legacyServices = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.service, (m.get(r.service) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // ─── Step 1: file ─────────────────────────────────────────────────────────────
  async function onFile(file: File) {
    setError(null);
    setFileName(file.name);
    let text = await file.text();
    // Excel-on-Windows exports are often cp1250; a UTF-8 decode then contains U+FFFD.
    if (text.includes("�")) {
      try { text = new TextDecoder("windows-1250").decode(await file.arrayBuffer()); } catch { /* keep utf-8 */ }
    }
    setParsed(parseLegacyCsv(text));
    setStep("upload");
  }

  async function loadContext(p: ParseResult) {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/dk/v1/admin/migration/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legacyIds: p.rows.map((r) => r.legacyId) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `Chyba ${res.status}`);
      const c = json as Ctx;
      setNowMs(Date.parse(c.now));
      setCtx(c);
      initMappings(c, p.rows);
      setTechnicianId((prev) => prev || c.defaultTechnicianId || c.technicians[0]?.id || "");
      setDryResults(null); setFinalResults(null); setImportError(null); setProgress(null);
      setPage(0);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function initMappings(c: Ctx, legacyRows: LegacyRow[]) {
    const users = c.users.filter((u) => u.accounts.length > 0);
    const byEmail = new Map(users.map((u) => [u.email, u]));
    const byPhone = new Map<string, CtxUser[]>();
    for (const u of users) {
      const k = phoneKey(u.phone);
      if (k.length === 9) byPhone.set(k, [...(byPhone.get(k) ?? []), u]);
    }
    const validPair = (userId: string, accountId: string | null) =>
      !!accountId && !!c.users.find((u) => u.id === userId)?.accounts.some((a) => a.id === accountId);

    const cm: Record<string, CustomerMapping> = {};
    for (const r of legacyRows) {
      const key = legacyCustomerKey(r);
      if (cm[key]) continue;
      const saved = c.mappings.customer[key];
      if (saved && validPair(saved.userId, saved.accountId)) {
        cm[key] = { userId: saved.userId, accountId: saved.accountId!, source: "saved" };
        continue;
      }
      const byMail = r.customerEmail ? byEmail.get(r.customerEmail) : undefined;
      if (byMail) {
        cm[key] = { userId: byMail.id, accountId: byMail.accounts[0].id, source: "email" };
        continue;
      }
      const phoneHits = byPhone.get(phoneKey(r.customerPhone)) ?? [];
      if (phoneHits.length === 1) {
        cm[key] = { userId: phoneHits[0].id, accountId: phoneHits[0].accounts[0].id, source: "phone" };
        continue;
      }
      cm[key] = { userId: "", accountId: "", source: "none" };
    }
    // Keep manual choices from a previous pass over the same file.
    setCustomerMap((prev) => {
      const next = { ...cm };
      for (const [k, v] of Object.entries(prev)) if (v.source === "manual" && next[k] && validPair(v.userId, v.accountId)) next[k] = v;
      return next;
    });

    const sm: Record<string, string> = {};
    const svcByName = new Map(c.services.map((s) => [normName(s.name), s.id]));
    for (const r of legacyRows) {
      if (r.service in sm) continue;
      const saved = c.mappings.service[r.service];
      sm[r.service] = saved && c.services.some((s) => s.id === saved) ? saved : svcByName.get(normName(r.service)) ?? "";
    }
    setServiceMap((prev) => ({ ...sm, ...Object.fromEntries(Object.entries(prev).filter(([k, v]) => k in sm && v)) }));
  }

  // ─── Effective mapping per row ────────────────────────────────────────────────
  const effective: Effective[] = useMemo(() => {
    if (!ctx) return [];
    const now = nowMs;
    return rows.map((row) => {
      const key = legacyCustomerKey(row);
      const ov = overrides[row.legacyId] ?? {};
      const group = customerMap[key];
      const userId = ov.userId ?? group?.userId ?? "";
      const accountId = ov.userId ? ov.accountId ?? "" : ov.accountId ?? group?.accountId ?? "";
      const serviceId = ov.serviceId ?? serviceMap[row.service] ?? "";
      const service = serviceById.get(serviceId);

      let status: DkStatus | "" = mapLegacyStatus(row.statusRaw) ?? "";
      if (status === "confirmed" && markPastCompleted) {
        const dur = row.durationMin ?? service?.duration_min ?? 60;
        if (pragueLocalToUtc(row.startsLocal).getTime() + dur * 60000 < now) status = "completed";
      }
      if (ov.status !== undefined) status = ov.status;

      const account = accountById.get(accountId);
      let locationId = ov.locationId ?? "";
      if (account && !account.locations.some((l) => l.id === locationId)) {
        const ak = addressKey(row.address);
        locationId =
          (ak && account.locations.find((l) => addressKey(l.street) === ak || addressKey(`${l.street} ${l.city}`) === ak)?.id) ||
          (account.defaultLocationId && account.locations.some((l) => l.id === account.defaultLocationId) ? account.defaultLocationId : "") ||
          account.locations.find((l) => l.is_default)?.id ||
          account.locations[0]?.id ||
          "";
      }

      const problems: string[] = [];
      const user = userById.get(userId);
      if (!user) problems.push("Není přiřazen cílový uživatel.");
      else if (!user.accounts.some((a) => a.id === accountId)) problems.push("Není vybrána ordinace uživatele.");
      if (account && account.locations.length === 0) problems.push(`Ordinace „${account.name}" nemá žádnou adresu — přidejte ji v sekci Ordinace.`);
      else if (account && !locationId) problems.push("Není vybráno místo.");
      if (!service) problems.push(`Služba „${row.service}" není přiřazena.`);
      if (!status) problems.push(`Neznámý stav „${row.statusRaw || "(prázdný)"}" — vyberte stav ručně.`);

      const migrated = ctx.migrated[String(row.legacyId)];
      const movedInLegacy = !!migrated && Math.abs(new Date(migrated.startsAt).getTime() - pragueLocalToUtc(row.startsLocal).getTime()) > 60000;
      const include = ov.include ?? true;
      const state: RowState = migrated ? "migrated" : problems.length ? "problem" : include ? "ready" : "excluded";

      return { row, key, userId, accountId, locationId, serviceId, status, include, userOverridden: ov.userId !== undefined, migrated, movedInLegacy, problems, state };
    });
  }, [ctx, nowMs, rows, overrides, customerMap, serviceMap, markPastCompleted, userById, accountById, serviceById]);

  const counts = useMemo(() => {
    const c = { all: effective.length, ready: 0, migrated: 0, problem: 0, excluded: 0 };
    for (const e of effective) c[e.state]++;
    return c;
  }, [effective]);

  const customerStats = useMemo(() => {
    const m = new Map<string, { total: number; migrated: number; problems: number }>();
    for (const e of effective) {
      const s = m.get(e.key) ?? { total: 0, migrated: 0, problems: 0 };
      s.total++;
      if (e.migrated) s.migrated++;
      else if (e.problems.length) s.problems++;
      m.set(e.key, s);
    }
    return m;
  }, [effective]);

  // ─── Mutators ─────────────────────────────────────────────────────────────────
  function setCustomer(key: string, userId: string, accountId?: string) {
    const u = userById.get(userId);
    setCustomerMap((p) => ({ ...p, [key]: { userId, accountId: accountId ?? u?.accounts[0]?.id ?? "", source: userId ? "manual" : "none" } }));
    setDryResults(null);
  }
  function setOverride(id: number, patch: RowOverride) {
    setOverrides((p) => {
      const next = { ...(p[id] ?? {}), ...patch };
      if (patch.userId !== undefined) {
        next.accountId = userById.get(patch.userId)?.accounts[0]?.id ?? "";
        delete next.locationId;
      }
      if (patch.accountId !== undefined && patch.userId === undefined) delete next.locationId;
      return { ...p, [id]: next };
    });
    setDryResults(null);
  }
  function clearUserOverride(id: number) {
    setOverrides((p) => {
      const next = { ...(p[id] ?? {}) };
      delete next.userId; delete next.accountId; delete next.locationId;
      return { ...p, [id]: next };
    });
    setDryResults(null);
  }

  // ─── Build API payload ────────────────────────────────────────────────────────
  function toImportRow(e: Effective): ImportRow {
    return {
      legacyId: e.row.legacyId,
      startsLocal: e.row.startsLocal,
      durationMin: e.row.durationMin,
      serviceId: e.serviceId,
      userId: e.userId,
      accountId: e.accountId,
      locationId: e.locationId,
      status: e.status as DkStatus,
      requesterName: e.row.customerName,
      requesterPhone: e.row.customerPhone,
      notes: e.row.notes,
      legacy: e.row,
    };
  }
  function mappingsToRemember() {
    return {
      customer: Object.fromEntries(
        Object.entries(customerMap)
          .filter(([k, v]) => v.userId && v.accountId && !k.startsWith("(bez e-mailu)"))
          .map(([k, v]) => [k, { userId: v.userId, accountId: v.accountId }])
      ),
      service: Object.fromEntries(Object.entries(serviceMap).filter(([, v]) => v)),
    };
  }

  async function callImport(payload: object): Promise<ImportResult[]> {
    const res = await fetch("/api/dk/v1/admin/migration/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error ?? `Chyba serveru ${res.status}`);
    return (json as { results: ImportResult[] }).results;
  }

  async function runDry() {
    setLoading(true); setError(null);
    try {
      const ready = effective.filter((e) => e.state === "ready");
      const results = await callImport({ dryRun: true, technicianId, rows: ready.map(toImportRow) });
      setDryResults(results);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    const okIds = new Set((dryResults ?? []).filter((r) => r.outcome === "would_import").map((r) => r.legacyId));
    const toSend = effective.filter((e) => e.state === "ready" && okIds.has(e.row.legacyId));
    const results = new Map<number, ImportResult>();
    setImportError(null);
    setProgress({ done: 0, total: toSend.length });
    setLoading(true);
    try {
      for (let i = 0; i < toSend.length; i += CHUNK) {
        const chunk = toSend.slice(i, i + CHUNK);
        const res = await callImport({
          dryRun: false,
          technicianId,
          rows: chunk.map(toImportRow),
          ...(i === 0 && remember ? { rememberMappings: mappingsToRemember() } : {}),
        });
        for (const r of res) results.set(r.legacyId, r);
        setProgress({ done: Math.min(i + CHUNK, toSend.length), total: toSend.length });
      }
    } catch (e) {
      setImportError(`${e instanceof Error ? e.message : String(e)} — import byl přerušen. Už importované rezervace zůstávají; spusťte import znovu, hotové řádky se přeskočí.`);
    } finally {
      setFinalResults(results);
      setLoading(false);
      setStep("done");
    }
  }

  // ─── Report ───────────────────────────────────────────────────────────────────
  function reportRows() {
    return effective.map((e) => {
      const r = finalResults?.get(e.row.legacyId);
      let outcome: string;
      let message = "";
      if (r) { outcome = r.outcome; message = r.message ?? ""; }
      else if (e.state === "migrated") { outcome = "skipped_existing"; message = "Již migrováno dříve."; }
      else if (e.state === "problem") { outcome = "problem"; message = e.problems.join(" "); }
      else if (e.state === "excluded") { outcome = "excluded"; }
      else {
        const d = dryResults?.find((x) => x.legacyId === e.row.legacyId);
        outcome = d?.outcome === "error" ? "error" : "not_run";
        message = d?.message ?? "";
      }
      return { e, outcome, message, reservationId: r?.reservationId ?? e.migrated?.reservationId ?? "" };
    });
  }

  function downloadReport() {
    const head = ["Bookly ID", "Datum", "Zákazník", "E-mail (Bookly)", "Cílový e-mail", "Ordinace", "Služba", "Stav", "Výsledek", "Zpráva", "ID rezervace"];
    const lines = reportRows().map(({ e, outcome, message, reservationId }) => [
      e.row.legacyId, e.row.startsLocal, e.row.customerName, e.row.customerEmail,
      userById.get(e.userId)?.email ?? "", accountById.get(e.accountId)?.name ?? "",
      serviceById.get(e.serviceId)?.name ?? e.row.service, e.status, OUTCOME_BADGE[outcome]?.text ?? outcome, message, reservationId,
    ].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `migrace-protokol-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────
  const assignableUsers = useMemo(() => (ctx?.users ?? []).filter((u) => u.accounts.length > 0), [ctx]);
  const userOptions = (
    <>
      <option value="">— vyberte uživatele —</option>
      {assignableUsers.map((u) => (
        <option key={u.id} value={u.id}>
          {u.email}{u.name ? ` — ${u.name}` : ""} ({u.accounts.map((a) => a.name).join(", ")})
        </option>
      ))}
    </>
  );
  const selectCls = "px-2 py-1.5 rounded-lg border text-sm bg-white focus:outline-none max-w-full";

  const visible = effective.filter((e) => filter === "all" || e.state === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE));
  const pageRows = visible.slice(page * PAGE, page * PAGE + PAGE);

  const steps = [
    { id: "upload", label: "1. Soubor" },
    { id: "map", label: "2. Přiřazení" },
    { id: "review", label: "3. Kontrola" },
    { id: "done", label: "4. Výsledek" },
  ] as const;

  return (
    <AdminShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--ink)", fontVariationSettings: "'wdth' 112" }}>Migrace rezervací</h1>
          <p className="text-sm" style={MUTED}>
            Import rezervací z původního systému (export Bookly v CSV). Rezervace se přiřadí existujícím uživatelům a ordinacím.
            Import lze spouštět opakovaně — již migrované rezervace se poznají podle ID z Bookly a přeskočí. Neodesílají se žádné e-maily
            a nevytvářejí se události v Google kalendáři.
          </p>
        </div>

        <ol className="flex flex-wrap gap-2 text-xs font-semibold">
          {steps.map((s) => (
            <li key={s.id} className="px-3 py-1 rounded-full border" style={step === s.id ? { background: "var(--cyan)", color: "#fff", borderColor: "var(--cyan)" } : { ...BORDER, color: "#6b7f8a", background: "#fff" }}>
              {s.label}
            </li>
          ))}
        </ol>

        {error && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{error}</div>}

        {/* ─── Step 1 ─────────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="bg-white rounded-xl border p-5 flex flex-col gap-4" style={BORDER}>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold" style={{ color: "var(--ink)" }}>CSV soubor s rezervacemi</span>
              <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="text-sm" />
              <span className="text-xs" style={MUTED}>
                Očekávané sloupce: ID, Appointment date, Customer name, Customer phone, Customer email, Service, Duration, Status, Notes, Customer address.
                Čas se bere jako pražský místní čas.
              </span>
            </label>

            {parsed && (
              <div className="flex flex-col gap-3 text-sm">
                <p style={{ color: "var(--ink)" }}>
                  <strong>{fileName}</strong>: {parsed.totalDataLines} datových řádků, načteno <strong>{parsed.rows.length}</strong> rezervací
                  {parsed.errors.length > 0 && <>, <span style={{ color: "#7a1a1a" }}>{parsed.errors.length} řádků nelze načíst</span></>}.
                </p>
                {parsed.missingColumns.length > 0 && (
                  <div className="rounded-lg p-3 border" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                    V souboru chybí povinné sloupce: {parsed.missingColumns.join(", ")}.
                  </div>
                )}
                {parsed.errors.length > 0 && (
                  <ul className="rounded-lg p-3 border text-xs flex flex-col gap-1 max-h-48 overflow-y-auto" style={{ background: "#fffbea", borderColor: "#f0d78a", color: "#7a5200" }}>
                    {parsed.errors.map((e, i) => <li key={i}>Řádek {e.line}: {e.message}</li>)}
                  </ul>
                )}
                <div className="flex justify-end">
                  <button onClick={() => loadContext(parsed)} disabled={loading || parsed.rows.length === 0}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--cyan)" }}>
                    {loading && <span className="dk-spinner" />}Pokračovat k přiřazení
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2 ─────────────────────────────────────────────────────── */}
        {step === "map" && ctx && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([["ready", "K importu"], ["migrated", "Již migrováno"], ["problem", "Problémy"], ["excluded", "Vynecháno"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => { setFilter(k); setPage(0); }} className="bg-white rounded-xl border p-3 text-left" style={filter === k ? { borderColor: "var(--cyan)" } : BORDER}>
                  <div className="text-2xl font-bold" style={{ color: k === "problem" && counts.problem ? "#7a1a1a" : "var(--ink)" }}>{counts[k]}</div>
                  <div className="text-xs" style={MUTED}>{label}</div>
                </button>
              ))}
            </div>

            {/* Settings */}
            <div className="bg-white rounded-xl border p-5 flex flex-col gap-3" style={BORDER}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Nastavení importu</p>
              <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                <span className="w-40 shrink-0" style={MUTED}>Technik</span>
                <select value={technicianId} onChange={(e) => { setTechnicianId(e.target.value); setDryResults(null); }} className={selectCls} style={BORDER}>
                  <option value="">— vyberte —</option>
                  {ctx.technicians.map((t) => <option key={t.id} value={t.id}>{t.display_name}{t.active ? "" : " (neaktivní)"}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={markPastCompleted} onChange={(e) => setMarkPastCompleted(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--cyan)" }} />
                <span style={{ color: "var(--ink)" }}>Proběhlé schválené rezervace označit jako dokončené</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4" style={{ accentColor: "var(--cyan)" }} />
                <span style={{ color: "var(--ink)" }}>Zapamatovat přiřazení zákazníků a služeb pro příští import</span>
              </label>
            </div>

            {/* Services */}
            <div className="bg-white rounded-xl border overflow-hidden" style={BORDER}>
              <div className="px-5 py-3 border-b" style={BORDER}>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Služby</p>
                <p className="text-xs" style={MUTED}>Každé službě z Bookly přiřaďte službu v portálu. Časové rezervy (buffery) se vezmou z portálové služby.</p>
              </div>
              <div className="divide-y" style={BORDER}>
                {legacyServices.map(([name, n]) => (
                  <div key={name} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0 text-sm" style={{ color: "var(--ink)" }}>{name || "(bez názvu)"} <span className="text-xs" style={MUTED}>· {n}×</span></div>
                    <select value={serviceMap[name] ?? ""} onChange={(e) => { setServiceMap((p) => ({ ...p, [name]: e.target.value })); setDryResults(null); }}
                      className={selectCls} style={serviceMap[name] ? BORDER : { borderColor: "#f07a7a" }}>
                      <option value="">— vyberte službu —</option>
                      {ctx.services.map((s) => <option key={s.id} value={s.id}>{s.code.toUpperCase()} · {s.name} ({s.duration_min} min){s.active ? "" : " — neaktivní"}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Customers */}
            <div className="bg-white rounded-xl border overflow-hidden" style={BORDER}>
              <div className="px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-2" style={BORDER}>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Zákazníci → uživatelé portálu</p>
                  <p className="text-xs" style={MUTED}>
                    Přiřazení platí pro všechny rezervace daného zákazníka. U jednotlivé rezervace jej lze změnit níže v tabulce rezervací.
                    Nabízejí se jen uživatelé, kteří jsou členem nějaké ordinace.
                  </p>
                </div>
                <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value as "all" | "attention")} className={selectCls} style={BORDER}>
                  <option value="all">Všichni ({customers.length})</option>
                  <option value="attention">Vyžadují pozornost</option>
                </select>
              </div>
              <div className="divide-y" style={BORDER}>
                {customers
                  .filter((c) => customerFilter === "all" || ["none", "phone"].includes(customerMap[c.key]?.source ?? "none"))
                  .map((c) => {
                    const m = customerMap[c.key] ?? { userId: "", accountId: "", source: "none" as const };
                    const u = userById.get(m.userId);
                    const st = customerStats.get(c.key);
                    return (
                      <div key={c.key} className="px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium break-all" style={{ color: "var(--ink)" }}>{c.key}</div>
                          <div className="text-xs" style={MUTED}>
                            {[...c.names].join(", ")}{c.phones.size ? ` · ${[...c.phones].join(", ")}` : ""} · {st?.total ?? 0} rez.
                            {st?.migrated ? `, ${st.migrated} již migrováno` : ""}
                          </div>
                        </div>
                        <Badge b={SOURCE_LABEL[m.source]} />
                        <select value={m.userId} onChange={(e) => setCustomer(c.key, e.target.value)} className={selectCls} style={m.userId ? BORDER : { borderColor: "#f07a7a" }}>
                          {userOptions}
                        </select>
                        {u && u.accounts.length > 1 && (
                          <select value={m.accountId} onChange={(e) => setCustomer(c.key, m.userId, e.target.value)} className={selectCls} style={BORDER}>
                            {u.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Rows */}
            <div className="bg-white rounded-xl border overflow-hidden" style={BORDER}>
              <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2" style={BORDER}>
                <p className="text-sm font-semibold flex-1" style={{ color: "var(--ink)" }}>Rezervace</p>
                {(["all", "ready", "migrated", "problem", "excluded"] as const).map((f) => (
                  <button key={f} onClick={() => { setFilter(f); setPage(0); }} className="text-xs px-2.5 py-1 rounded-full border"
                    style={filter === f ? { background: "var(--cyan)", color: "#fff", borderColor: "var(--cyan)" } : { ...BORDER, color: "#6b7f8a" }}>
                    {f === "all" ? "Vše" : STATE_BADGE[f].text} ({counts[f]})
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ ...MUTED, background: "var(--porcelain)" }}>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2">Bookly</th>
                      <th className="px-3 py-2">Zákazník → uživatel</th>
                      <th className="px-3 py-2">Služba · stav</th>
                      <th className="px-3 py-2">Místo</th>
                      <th className="px-3 py-2">Stav řádku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={BORDER}>
                    {pageRows.map((e) => {
                      const account = accountById.get(e.accountId);
                      const u = userById.get(e.userId);
                      const locked = !!e.migrated;
                      return (
                        <tr key={e.row.legacyId} className="align-top" style={locked ? { opacity: 0.7 } : undefined}>
                          <td className="px-3 py-2">
                            <input type="checkbox" disabled={locked} checked={!locked && e.include} onChange={(ev) => setOverride(e.row.legacyId, { include: ev.target.checked })}
                              className="w-4 h-4" style={{ accentColor: "var(--cyan)" }} aria-label={`Importovat ${e.row.legacyId}`} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-medium" style={{ color: "var(--ink)" }}>#{e.row.legacyId}</div>
                            <div className="text-xs" style={MUTED}>{fmtLocal(e.row.startsLocal)}{e.row.durationMin ? ` · ${e.row.durationMin} min` : ""}</div>
                          </td>
                          <td className="px-3 py-2 min-w-[260px]">
                            <div className="text-xs mb-1 break-all" style={MUTED}>{e.row.customerName} · {e.row.customerEmail || "bez e-mailu"}</div>
                            {locked ? (
                              <div className="text-xs" style={{ color: "var(--ink)" }}>{e.migrated!.accountName}</div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <select value={e.userId} onChange={(ev) => setOverride(e.row.legacyId, { userId: ev.target.value })} className={selectCls} style={e.userId ? BORDER : { borderColor: "#f07a7a" }}>
                                  {userOptions}
                                </select>
                                {u && u.accounts.length > 1 && (
                                  <select value={e.accountId} onChange={(ev) => setOverride(e.row.legacyId, { accountId: ev.target.value })} className={selectCls} style={BORDER}>
                                    {u.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                                )}
                                {e.userOverridden && (
                                  <button onClick={() => clearUserOverride(e.row.legacyId)} className="text-xs text-left underline" style={{ color: "var(--cyan-deep)" }}>
                                    Změněno jen u této rezervace — vrátit přiřazení zákazníka
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 min-w-[200px]">
                            {locked ? (
                              <div className="text-xs" style={{ color: "var(--ink)" }}>{e.row.service}</div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <select value={e.serviceId} onChange={(ev) => setOverride(e.row.legacyId, { serviceId: ev.target.value })} className={selectCls} style={e.serviceId ? BORDER : { borderColor: "#f07a7a" }}>
                                  <option value="">— služba —</option>
                                  {ctx.services.map((s) => <option key={s.id} value={s.id}>{s.code.toUpperCase()} · {s.name}</option>)}
                                </select>
                                <select value={e.status} onChange={(ev) => setOverride(e.row.legacyId, { status: ev.target.value as DkStatus | "" })} className={selectCls} style={e.status ? BORDER : { borderColor: "#f07a7a" }}>
                                  <option value="">— stav —</option>
                                  {(Object.keys(STATUS_LABEL) as DkStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                                <span className="text-xs" style={MUTED}>Bookly: {e.row.statusRaw || "—"}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 min-w-[180px]">
                            <div className="text-xs mb-1" style={MUTED}>{e.row.address || "bez adresy"}</div>
                            {!locked && account && account.locations.length > 0 && (
                              <select value={e.locationId} onChange={(ev) => setOverride(e.row.legacyId, { locationId: ev.target.value })} className={selectCls} style={BORDER}>
                                {account.locations.map((l) => <option key={l.id} value={l.id}>{l.label} — {l.street}, {l.city}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 min-w-[160px]">
                            <Badge b={STATE_BADGE[e.state]} />
                            {e.migrated && (
                              <div className="text-xs mt-1" style={MUTED}>
                                {fmtIso(e.migrated.startsAt)} · {STATUS_LABEL[e.migrated.status as DkStatus] ?? e.migrated.status}
                                {e.movedInLegacy && <div style={{ color: "#7a5200" }}>Čas v Bookly se od migrace liší — v portálu ponecháno beze změny.</div>}
                              </div>
                            )}
                            {e.state === "problem" && (
                              <ul className="text-xs mt-1 flex flex-col gap-0.5" style={{ color: "#7a1a1a" }}>
                                {e.problems.map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-4 text-sm" style={MUTED}>Žádné rezervace v tomto filtru.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="px-5 py-3 border-t flex items-center gap-3 text-sm" style={BORDER}>
                  <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40" style={BORDER}>←</button>
                  <span style={MUTED}>Strana {page + 1} / {pageCount}</span>
                  <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40" style={BORDER}>→</button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button onClick={() => setStep("upload")} className="text-sm px-4 py-2 rounded-lg border" style={{ ...BORDER, color: "#6b7f8a" }}>Zpět na výběr souboru</button>
              <div className="flex items-center gap-3">
                {counts.problem > 0 && <span className="text-xs" style={{ color: "#7a5200" }}>{counts.problem} rezervací s problémem se neimportuje, dokud je nevyřešíte.</span>}
                <button onClick={runDry} disabled={loading || counts.ready === 0 || !technicianId}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--cyan)" }}>
                  {loading && <span className="dk-spinner" />}Ověřit {counts.ready} rezervací (zkušební běh)
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── Step 3 ─────────────────────────────────────────────────────── */}
        {step === "review" && dryResults && (() => {
          const ok = dryResults.filter((r) => r.outcome === "would_import");
          const skipped = dryResults.filter((r) => r.outcome === "skipped_existing");
          const errs = dryResults.filter((r) => r.outcome === "error");
          return (
            <div className="bg-white rounded-xl border p-5 flex flex-col gap-4" style={BORDER}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Výsledek zkušebního běhu (nic se zatím neuložilo)</p>
              <ul className="text-sm flex flex-col gap-1" style={{ color: "var(--ink)" }}>
                <li><strong>{ok.length}</strong> rezervací bude importováno</li>
                <li><strong>{counts.migrated + skipped.length}</strong> již migrováno — přeskočí se</li>
                {errs.length > 0 && <li style={{ color: "#7a1a1a" }}><strong>{errs.length}</strong> nelze importovat (viz níže)</li>}
                {counts.problem > 0 && <li style={{ color: "#7a5200" }}><strong>{counts.problem}</strong> nepřiřazeno — neimportuje se</li>}
                {counts.excluded > 0 && <li style={MUTED}><strong>{counts.excluded}</strong> ručně vynecháno</li>}
              </ul>
              {errs.length > 0 && (
                <ul className="rounded-lg p-3 border text-xs flex flex-col gap-1 max-h-64 overflow-y-auto" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>
                  {errs.map((r) => {
                    const row = rows.find((x) => x.legacyId === r.legacyId);
                    return <li key={r.legacyId}>#{r.legacyId}{row ? ` (${fmtLocal(row.startsLocal)}, ${row.customerEmail})` : ""}: {r.message}</li>;
                  })}
                </ul>
              )}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                <button onClick={() => setStep("map")} className="text-sm px-4 py-2 rounded-lg border" style={{ ...BORDER, color: "#6b7f8a" }}>Zpět k úpravám</button>
                <button onClick={runImport} disabled={loading || ok.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2" style={{ background: "var(--cyan)" }}>
                  {loading && <span className="dk-spinner" />}
                  {progress ? `Importuji ${progress.done} / ${progress.total}…` : `Importovat ${ok.length} rezervací`}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ─── Step 4 ─────────────────────────────────────────────────────── */}
        {step === "done" && finalResults && (() => {
          const report = reportRows();
          const by = (o: string) => report.filter((r) => r.outcome === o).length;
          return (
            <>
              {importError && <div className="rounded-xl p-4 border text-sm" style={{ background: "#fff5f5", borderColor: "#f07a7a", color: "#7a1a1a" }}>{importError}</div>}
              <div className="bg-white rounded-xl border p-5 flex flex-col gap-4" style={BORDER}>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Import dokončen</p>
                <ul className="text-sm flex flex-col gap-1" style={{ color: "var(--ink)" }}>
                  <li><strong>{by("imported")}</strong> importováno</li>
                  <li><strong>{by("skipped_existing")}</strong> již migrováno — přeskočeno</li>
                  {by("error") > 0 && <li style={{ color: "#7a1a1a" }}><strong>{by("error")}</strong> chyb</li>}
                  {by("problem") > 0 && <li style={{ color: "#7a5200" }}><strong>{by("problem")}</strong> nepřiřazeno</li>}
                  {by("not_run") > 0 && <li style={{ color: "#7a5200" }}><strong>{by("not_run")}</strong> nezpracováno</li>}
                  {by("excluded") > 0 && <li style={MUTED}><strong>{by("excluded")}</strong> vynecháno</li>}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <button onClick={downloadReport} className="text-sm px-4 py-2 rounded-lg border" style={{ ...BORDER, color: "var(--ink)" }}>Stáhnout protokol (CSV)</button>
                  <button onClick={() => parsed && loadContext(parsed)} disabled={loading} className="text-sm px-4 py-2 rounded-lg border inline-flex items-center gap-2" style={{ ...BORDER, color: "var(--ink)" }}>
                    {loading && <span className="dk-spinner" />}Znovu načíst stejný soubor
                  </button>
                  <button onClick={() => { setParsed(null); setFileName(""); setStep("upload"); }} className="text-sm px-4 py-2 rounded-lg text-white" style={{ background: "var(--cyan)" }}>Nový soubor</button>
                </div>
              </div>
              <div className="bg-white rounded-xl border overflow-x-auto" style={BORDER}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ ...MUTED, background: "var(--porcelain)" }}>
                      <th className="px-3 py-2">Bookly</th><th className="px-3 py-2">Zákazník</th><th className="px-3 py-2">Cílový uživatel</th><th className="px-3 py-2">Výsledek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={BORDER}>
                    {report.filter((r) => r.outcome !== "skipped_existing" || finalResults.has(r.e.row.legacyId)).slice(0, 500).map(({ e, outcome, message }) => (
                      <tr key={e.row.legacyId} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">#{e.row.legacyId}<div className="text-xs" style={MUTED}>{fmtLocal(e.row.startsLocal)}</div></td>
                        <td className="px-3 py-2 break-all">{e.row.customerEmail || e.row.customerName}</td>
                        <td className="px-3 py-2 break-all">{userById.get(e.userId)?.email ?? "—"}<div className="text-xs" style={MUTED}>{accountById.get(e.accountId)?.name ?? ""}</div></td>
                        <td className="px-3 py-2"><Badge b={OUTCOME_BADGE[outcome] ?? OUTCOME_BADGE.error} />{message && <div className="text-xs mt-1" style={MUTED}>{message}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>
    </AdminShell>
  );
}
