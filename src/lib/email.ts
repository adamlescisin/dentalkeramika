/**
 * Transactional email via Resend (free tier: 3 k/month).
 * Uses the Resend REST API directly — no SDK dependency needed.
 */

const RESEND_API = "https://api.resend.com/emails";
const FROM = `DentálníKeramika <rezervace@dentalkeramika.cz>`;

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

async function send(payload: EmailPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ─── Transactional templates ──────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string
): Promise<void> {
  await send({
    to: email,
    subject: "Potvrďte svůj e-mail — DentálníKeramika",
    html: `
      <p>Dobrý den,</p>
      <p>Pro dokončení registrace klikněte na odkaz níže:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Odkaz je platný 60 minut.</p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendMagicLink(
  email: string,
  magicUrl: string
): Promise<void> {
  await send({
    to: email,
    subject: "Přihlásit se — DentálníKeramika",
    html: `
      <p>Dobrý den,</p>
      <p>Pro přihlášení klikněte na odkaz níže (platný 15 minut):</p>
      <p><a href="${magicUrl}">${magicUrl}</a></p>
      <p>Pokud jste o přihlášení nežádali, tento e-mail ignorujte.</p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendPasswordReset(
  email: string,
  resetUrl: string
): Promise<void> {
  await send({
    to: email,
    subject: "Obnova hesla — DentálníKeramika",
    html: `
      <p>Dobrý den,</p>
      <p>Pro nastavení nového hesla klikněte na odkaz níže (platný 60 minut):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Po použití odkazu budou ukončeny všechny vaše přihlášené relace.</p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendReservationConfirmation(params: {
  email: string;
  accountName: string;
  serviceName: string;
  startsAt: Date;
  locationLabel: string;
  locationAddress: string;
  technicianName: string;
  icsAttachment?: string; // base64-encoded .ics
}): Promise<void> {
  const dateStr = params.startsAt.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await send({
    to: params.email,
    subject: `Termín potvrzen — ${params.serviceName}`,
    html: `
      <p>Dobrý den,</p>
      <p>Váš termín byl potvrzen:</p>
      <table>
        <tr><th>Služba</th><td>${params.serviceName}</td></tr>
        <tr><th>Termín</th><td>${dateStr}</td></tr>
        <tr><th>Adresa</th><td>${params.locationLabel} — ${params.locationAddress}</td></tr>
        <tr><th>Technik</th><td>${params.technicianName}</td></tr>
      </table>
      <p>Termín lze přeložit nebo zrušit v portálu do 24 hodin před návštěvou.</p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendRescheduleConfirmation(params: {
  email: string;
  serviceName: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  locationLabel: string;
  technicianName: string;
}): Promise<void> {
  const fmt = (d: Date) =>
    d.toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  await send({
    to: params.email,
    subject: `Termín přeložen — ${params.serviceName}`,
    html: `
      <p>Dobrý den,</p>
      <p>Váš termín byl přeložen:</p>
      <table>
        <tr><th>Původní termín</th><td><s>${fmt(params.oldStartsAt)}</s></td></tr>
        <tr><th>Nový termín</th><td><strong>${fmt(params.newStartsAt)}</strong></td></tr>
        <tr><th>Adresa</th><td>${params.locationLabel}</td></tr>
        <tr><th>Technik</th><td>${params.technicianName}</td></tr>
      </table>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendCancellationConfirmation(params: {
  email: string;
  serviceName: string;
  startsAt: Date;
  reason?: string;
}): Promise<void> {
  const dateStr = params.startsAt.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await send({
    to: params.email,
    subject: `Termín zrušen — ${params.serviceName}`,
    html: `
      <p>Dobrý den,</p>
      <p>Váš termín byl zrušen:</p>
      <table>
        <tr><th>Služba</th><td>${params.serviceName}</td></tr>
        <tr><th>Datum</th><td>${dateStr}</td></tr>
        ${params.reason ? `<tr><th>Důvod</th><td>${params.reason}</td></tr>` : ""}
      </table>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendAccountApproved(
  email: string,
  portalUrl: string
): Promise<void> {
  await send({
    to: email,
    subject: "Váš účet byl schválen — DentálníKeramika",
    html: `
      <p>Dobrý den,</p>
      <p>Váš účet byl schválen. Nyní si můžete rezervovat termíny v portálu:</p>
      <p><a href="${portalUrl}">${portalUrl}</a></p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}

export async function sendTeamInvite(params: {
  inviteeEmail: string;
  inviterName: string;
  accountName: string;
  acceptUrl: string;
}): Promise<void> {
  await send({
    to: params.inviteeEmail,
    subject: `Pozvánka do týmu — ${params.accountName}`,
    html: `
      <p>Dobrý den,</p>
      <p>${params.inviterName} vás zve ke správě rezervací pro <strong>${params.accountName}</strong>.</p>
      <p>Pro přijetí pozvánky klikněte na odkaz níže:</p>
      <p><a href="${params.acceptUrl}">${params.acceptUrl}</a></p>
      <p>Tým DentálníKeramika</p>
    `,
  });
}
