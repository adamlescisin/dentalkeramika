/**
 * Legacy (Bookly) appointment export — parsing and value mapping.
 *
 * Pure module: no server imports, used both by the admin migration wizard in
 * the browser and by the import API for re-validation.
 */

export type DkStatus = "pending" | "confirmed" | "cancelled" | "rejected" | "completed";

export interface LegacyRow {
  /** 1-based line number in the CSV (header = line 1). */
  line: number;
  legacyId: number;
  /** Prague local time, normalised to "YYYY-MM-DD HH:MM". */
  startsLocal: string;
  customerName: string;
  customerPhone: string;
  /** Lower-cased, trimmed. Empty string if the export has none. */
  customerEmail: string;
  service: string;
  durationMin: number | null;
  statusRaw: string;
  notes: string;
  address: string;
}

/** One row as sent to the import API, with the wizard's mapping applied. */
export interface ImportRow {
  legacyId: number;
  startsLocal: string;
  durationMin: number | null;
  serviceId: string;
  userId: string;
  accountId: string;
  locationId: string;
  status: DkStatus;
  requesterName: string;
  requesterPhone: string;
  notes: string;
  legacy: LegacyRow;
}

export type ImportOutcome = "imported" | "would_import" | "skipped_existing" | "error";

export interface ImportResult {
  legacyId: number;
  outcome: ImportOutcome;
  reservationId?: string;
  message?: string;
}

export interface ParseResult {
  rows: LegacyRow[];
  errors: { line: number; message: string }[];
  missingColumns: string[];
  delimiter: string;
  totalDataLines: number;
}

// ─── CSV tokenizer (RFC 4180, quoted fields may span lines) ──────────────────

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = -1;
  for (const d of [",", ";", "\t"]) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Returns records with the 1-based line number each record starts on. */
export function parseCsv(text: string, delimiter: string): { line: number; fields: string[] }[] {
  const out: { line: number; fields: string[] }[] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    fields.push(field);
    // Skip completely empty lines
    if (!(fields.length === 1 && fields[0].trim() === "")) out.push({ line: recordLine, fields });
    fields = [];
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else if (ch === "\r") {
      // handled by \n
    } else if (ch === "\n") {
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || fields.length > 0) endRecord();
  return out;
}

// ─── Header mapping ───────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type FieldKey =
  | "id" | "date" | "customerName" | "customerPhone" | "customerEmail"
  | "service" | "duration" | "status" | "notes" | "address";

// English Bookly export headers plus the Czech-localised variants.
const HEADER_ALIASES: Record<FieldKey, string[]> = {
  id: ["id", "appointment id", "booking id"],
  date: ["appointment date", "date", "datum", "datum rezervace", "datum schuzky"],
  customerName: ["customer name", "customer", "zakaznik", "jmeno zakaznika", "jmeno"],
  customerPhone: ["customer phone", "phone", "telefon", "telefon zakaznika"],
  customerEmail: ["customer email", "email", "e mail", "e mail zakaznika", "email zakaznika"],
  service: ["service", "sluzba"],
  duration: ["duration", "delka", "trvani"],
  status: ["status", "stav"],
  notes: ["notes", "note", "poznamka", "poznamky"],
  address: ["customer address", "address", "adresa", "adresa zakaznika"],
};

const REQUIRED: FieldKey[] = ["id", "date", "customerEmail", "service"];

const FIELD_LABELS: Record<FieldKey, string> = {
  id: "ID",
  date: "Appointment date",
  customerName: "Customer name",
  customerPhone: "Customer phone",
  customerEmail: "Customer email",
  service: "Service",
  duration: "Duration",
  status: "Status",
  notes: "Notes",
  address: "Customer address",
};

// ─── Values ───────────────────────────────────────────────────────────────────

/** Accepts "YYYY-MM-DD HH:MM[:SS]" and "D.M.YYYY HH:MM[:SS]". */
export function normaliseLocalDateTime(raw: string): string | null {
  const s = raw.trim();
  let y: number, mo: number, d: number, h: number, mi: number;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  } else {
    m = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return null;
    [d, mo, y, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCDate() !== d) return null;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p2(mo)}-${p2(d)} ${p2(h)}:${p2(mi)}`;
}

function pragueOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD HH:MM" in Europe/Prague → UTC Date (DST-aware). */
export function pragueLocalToUtc(local: string): Date {
  const [datePart, timePart] = local.split(" ");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let ts = naive - pragueOffsetMs(new Date(naive));
  // Second pass corrects the offset when the guess landed across a DST switch.
  ts = naive - pragueOffsetMs(new Date(ts));
  return new Date(ts);
}

const STATUS_MAP: Record<string, DkStatus> = {
  approved: "confirmed",
  schvaleno: "confirmed",
  potvrzeno: "confirmed",
  pending: "pending",
  ceka: "pending",
  "ceka na schvaleni": "pending",
  nevyrizeno: "pending",
  cancelled: "cancelled",
  canceled: "cancelled",
  zruseno: "cancelled",
  rejected: "rejected",
  zamitnuto: "rejected",
  odmitnuto: "rejected",
  done: "completed",
  hotovo: "completed",
  dokonceno: "completed",
};

/** Maps a Bookly status label to a portal status, or null if unknown (e.g. "Waitlisted"). */
export function mapLegacyStatus(raw: string): DkStatus | null {
  return STATUS_MAP[norm(raw)] ?? null;
}

/** Loose comparison key for addresses ("Václavské nám. 1" ≈ "vaclavske nam 1"). */
export function addressKey(s: string): string {
  return norm(s)
    .replace(/\bnamesti\b/g, "nam")
    .replace(/\bulice\b/g, "ul")
    .replace(/\s+/g, " ");
}

export function legacyCustomerKey(r: Pick<LegacyRow, "customerEmail" | "customerName">): string {
  return r.customerEmail || `(bez e-mailu) ${r.customerName.trim() || "?"}`;
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function parseLegacyCsv(input: string): ParseResult {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records = parseCsv(text, delimiter);
  const errors: ParseResult["errors"] = [];

  if (records.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "Soubor je prázdný." }], missingColumns: [], delimiter, totalDataLines: 0 };
  }

  const header = records[0].fields.map(norm);
  const index = {} as Record<FieldKey, number>;
  for (const key of Object.keys(HEADER_ALIASES) as FieldKey[]) {
    index[key] = header.findIndex((h) => HEADER_ALIASES[key].includes(h));
  }
  const missingColumns = REQUIRED.filter((k) => index[k] < 0).map((k) => FIELD_LABELS[k]);
  if (missingColumns.length) {
    return { rows: [], errors: [], missingColumns, delimiter, totalDataLines: records.length - 1 };
  }

  const get = (fields: string[], key: FieldKey) => (index[key] >= 0 ? (fields[index[key]] ?? "").trim() : "");
  const rows: LegacyRow[] = [];
  const seen = new Map<number, number>();

  for (const { line, fields } of records.slice(1)) {
    const idRaw = get(fields, "id");
    const legacyId = Number(idRaw);
    if (!/^\d+$/.test(idRaw) || !Number.isSafeInteger(legacyId) || legacyId > 2_147_483_647) {
      errors.push({ line, message: `Neplatné ID „${idRaw}".` });
      continue;
    }
    if (seen.has(legacyId)) {
      errors.push({ line, message: `ID ${legacyId} je v souboru dvakrát (poprvé na řádku ${seen.get(legacyId)}) — druhý výskyt přeskočen.` });
      continue;
    }
    const dateRaw = get(fields, "date");
    const startsLocal = normaliseLocalDateTime(dateRaw);
    if (!startsLocal) {
      errors.push({ line, message: `ID ${legacyId}: neplatné datum „${dateRaw}".` });
      continue;
    }
    seen.set(legacyId, line);

    const durRaw = get(fields, "duration");
    const dur = /^\d+$/.test(durRaw) ? Number(durRaw) : null;

    rows.push({
      line,
      legacyId,
      startsLocal,
      customerName: get(fields, "customerName"),
      customerPhone: get(fields, "customerPhone"),
      customerEmail: get(fields, "customerEmail").toLowerCase(),
      service: get(fields, "service"),
      durationMin: dur && dur > 0 ? dur : null,
      statusRaw: get(fields, "status"),
      notes: get(fields, "notes"),
      address: get(fields, "address"),
    });
  }

  return { rows, errors, missingColumns, delimiter, totalDataLines: records.length - 1 };
}
