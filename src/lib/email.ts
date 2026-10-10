/**
 * Transactional email via Resend (free tier: 3 k/month).
 * Uses the Resend REST API directly — no SDK dependency needed.
 */

const RESEND_API = "https://api.resend.com/emails";
const FROM = `DentálníKeramika <rezervace@dentalkeramika.cz>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dentalkeramika.cz";

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

// ─── HTML email shell ─────────────────────────────────────────────────────────

/**
 * Builds a full HTML email document around the provided body content.
 * Uses table-based layout and inline styles for broad email client support.
 *
 * @param body   Inner HTML — paragraphs, detail rows, note blocks, etc.
 * @param cta    Optional call-to-action { label, url }
 */
function buildEmail(body: string, cta?: { label: string; url: string }): string {
  const ctaHtml = cta
    ? `
      <tr>
        <td align="center" style="padding: 28px 0 8px;">
          <a href="${cta.url}"
             style="display:inline-block;background:#0697BC;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.01em;text-decoration:none;padding:13px 32px;border-radius:8px;">
            ${cta.label}
          </a>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>DentálníKeramika</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#F1F5F6;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px 40px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;
                      border:1px solid #D6E0E4;box-shadow:0 1px 3px rgba(35,50,61,0.06);">

          <!-- Brand header: cyan accent stripe + white logo area -->
          <tr>
            <td style="background:#0697BC;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:20px 32px 18px;border-bottom:1px solid #D6E0E4;">
              <a href="${APP_URL}" style="text-decoration:none;display:inline-block;">
                <img src="${APP_URL}/logo.webp" alt="DentálníKeramika" width="200" height="52"
                     style="display:block;max-width:200px;height:auto;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${body}
                ${ctaHtml}
              </table>
            </td>
          </tr>

          <!-- Divider + footer -->
          <tr>
            <td style="padding:24px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #D6E0E4;padding-top:20px;">
                    <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                               color:#6b7f8a;line-height:1.5;">
                      S pozdravem,<br />
                      <strong style="color:#23323D;">Tým DentálníKeramika</strong>
                    </p>
                    <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;
                               color:#9aacb8;line-height:1.5;">
                      Tento e-mail byl odeslán automaticky. Na tento e-mail neodpovídejte.<br />
                      <a href="${APP_URL}" style="color:#0697BC;text-decoration:none;">${APP_URL}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Renders a standard paragraph. */
function p(text: string): string {
  return `<tr><td style="padding-bottom:14px;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#23323D;">${text}</p>
  </td></tr>`;
}

/** Renders a label/value detail table (for reservation info etc.). */
function detailTable(rows: [string, string][]): string {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:8px 12px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;
                 color:#6b7f8a;white-space:nowrap;vertical-align:top;width:130px;">${label}</td>
      <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;
                 color:#23323D;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`
    )
    .join("");

  return `<tr><td style="padding-bottom:20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F1F5F6;border-radius:8px;padding:4px 16px;border:1px solid #D6E0E4;">
      ${rowsHtml}
    </table>
  </td></tr>`;
}

/** Renders a muted note block (for warnings, expiry notices, etc.). */
function note(text: string): string {
  return `<tr><td style="padding-bottom:16px;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;
               line-height:1.6;color:#6b7f8a;">${text}</p>
  </td></tr>`;
}

/** Renders a plain URL as a fallback link below a CTA button. */
function fallbackUrl(url: string): string {
  return `<tr><td style="padding-bottom:20px;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
               color:#9aacb8;word-break:break-all;">
      Pokud tlačítko nefunguje, zkopírujte a vložte tento odkaz do prohlížeče:<br />
      <a href="${url}" style="color:#0697BC;text-decoration:none;">${url}</a>
    </p>
  </td></tr>`;
}

// ─── Transactional templates ──────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string
): Promise<void> {
  const body =
    p("Dobrý den,") +
    p("Děkujeme za registraci. Pro dokončení ověřte svůj e-mail kliknutím na tlačítko níže.") +
    note("Odkaz je platný <strong>60 minut</strong>. Po ověření se budete moci přihlásit.") +
    fallbackUrl(verifyUrl);

  await send({
    to: email,
    subject: "Potvrďte svůj e-mail — DentálníKeramika",
    html: buildEmail(body, { label: "Ověřit e-mail", url: verifyUrl }),
  });
}

export async function sendMagicLink(
  email: string,
  magicUrl: string
): Promise<void> {
  const body =
    p("Dobrý den,") +
    p("Obdrželi jsme žádost o přihlášení bez hesla. Klikněte na tlačítko níže — budete okamžitě přihlášeni.") +
    note("Odkaz je platný <strong>15 minut</strong> a lze jej použít pouze jednou. Pokud jste přihlášení nežádali, tento e-mail ignorujte.") +
    fallbackUrl(magicUrl);

  await send({
    to: email,
    subject: "Přihlásit se — DentálníKeramika",
    html: buildEmail(body, { label: "Přihlásit se", url: magicUrl }),
  });
}

export async function sendPasswordReset(
  email: string,
  resetUrl: string
): Promise<void> {
  const body =
    p("Dobrý den,") +
    p("Obdrželi jsme žádost o obnovu hesla k vašemu účtu. Klikněte na tlačítko níže a nastavte nové heslo.") +
    note("Odkaz je platný <strong>60 minut</strong>. Po použití budou ukončeny všechny přihlášené relace. Pokud jste heslo neobnovovali, tento e-mail ignorujte.") +
    fallbackUrl(resetUrl);

  await send({
    to: email,
    subject: "Obnova hesla — DentálníKeramika",
    html: buildEmail(body, { label: "Nastavit nové heslo", url: resetUrl }),
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
  icsAttachment?: string;
  reservationId?: string;
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

  const body =
    p("Dobrý den,") +
    p("Váš termín byl potvrzen. Těšíme se na vaši návštěvu.") +
    detailTable([
      ["Služba", params.serviceName],
      ["Termín", dateStr],
      ["Adresa", `${params.locationLabel}<br /><span style="font-weight:400;color:#6b7f8a;">${params.locationAddress}</span>`],
      ["Technik", params.technicianName],
    ]) +
    note(`Termín lze přeložit nebo zrušit přes <a href="${APP_URL}/portal/rezervace" style="color:#0697BC;text-decoration:none;">portál</a> nejpozději 24 hodin před návštěvou.`);

  const reservationUrl = params.reservationId
    ? `${APP_URL}/portal/rezervace/${params.reservationId}`
    : `${APP_URL}/portal/rezervace`;

  await send({
    to: params.email,
    subject: `Termín potvrzen — ${params.serviceName}`,
    html: buildEmail(body, { label: "Zobrazit rezervaci", url: reservationUrl }),
  });
}

export async function sendReservationPending(params: {
  email: string;
  serviceName: string;
  startsAt: Date;
  locationLabel: string;
  locationAddress: string;
  reservationId?: string;
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

  const body =
    p("Dobrý den,") +
    p("Vaše žádost o termín byla přijata a čeká na schválení. O výsledku vás budeme informovat e-mailem.") +
    detailTable([
      ["Služba", params.serviceName],
      ["Požadovaný termín", dateStr],
      ["Adresa", `${params.locationLabel}<br /><span style="font-weight:400;color:#6b7f8a;">${params.locationAddress}</span>`],
    ]) +
    note(`Stav žádosti můžete sledovat v <a href="${APP_URL}/portal/rezervace" style="color:#0697BC;text-decoration:none;">portálu</a>.`);

  const reservationUrl = params.reservationId
    ? `${APP_URL}/portal/rezervace/${params.reservationId}`
    : `${APP_URL}/portal/rezervace`;

  await send({
    to: params.email,
    subject: `Žádost o termín přijata — ${params.serviceName}`,
    html: buildEmail(body, { label: "Zobrazit rezervaci", url: reservationUrl }),
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

  const body =
    p("Dobrý den,") +
    p("Váš termín byl přeložen na nový datum.") +
    detailTable([
      ["Původní termín", `<s style="color:#9aacb8;">${fmt(params.oldStartsAt)}</s>`],
      ["Nový termín", fmt(params.newStartsAt)],
      ["Adresa", params.locationLabel],
      ["Technik", params.technicianName],
    ]) +
    note(`Termín lze opět přeložit nebo zrušit přes <a href="${APP_URL}/portal/rezervace" style="color:#0697BC;text-decoration:none;">portál</a>.`);

  await send({
    to: params.email,
    subject: `Termín přeložen — ${params.serviceName}`,
    html: buildEmail(body, { label: "Zobrazit rezervaci", url: `${APP_URL}/portal/rezervace` }),
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

  const rows: [string, string][] = [
    ["Služba", params.serviceName],
    ["Datum", dateStr],
  ];
  if (params.reason) rows.push(["Důvod", params.reason]);

  const body =
    p("Dobrý den,") +
    p("Váš termín byl zrušen.") +
    detailTable(rows) +
    note(`Nový termín si lze objednat přes <a href="${APP_URL}/rezervace" style="color:#0697BC;text-decoration:none;">rezervační formulář</a>.`);

  await send({
    to: params.email,
    subject: `Termín zrušen — ${params.serviceName}`,
    html: buildEmail(body),
  });
}

export async function sendAccountApproved(
  email: string,
  portalUrl: string
): Promise<void> {
  const body =
    p("Dobrý den,") +
    p("Váš účet byl schválen. Nyní si můžete rezervovat termíny skenu v portálu.") +
    note("Přihlaste se svým e-mailem a heslem, které jste nastavili při registraci.") +
    fallbackUrl(portalUrl);

  await send({
    to: email,
    subject: "Váš účet byl schválen — DentálníKeramika",
    html: buildEmail(body, { label: "Přejít do portálu", url: portalUrl }),
  });
}

export async function sendAdminOnboardingInvite(params: {
  email: string;
  practiceName: string;
  setPasswordUrl: string;
}): Promise<void> {
  const body =
    p("Dobrý den,") +
    p(`Váš účet pro ordinaci <strong>${params.practiceName}</strong> byl vytvořen v systému DentálníKeramika.`) +
    p("Pro nastavení hesla a první přihlášení klikněte na tlačítko níže.") +
    note("Odkaz je platný <strong>72 hodin</strong>.") +
    fallbackUrl(params.setPasswordUrl);

  await send({
    to: params.email,
    subject: `Vítejte v DentálníKeramika — nastavte si přístup`,
    html: buildEmail(body, { label: "Nastavit heslo", url: params.setPasswordUrl }),
  });
}

export async function sendTeamInvite(params: {
  inviteeEmail: string;
  inviterName: string;
  accountName: string;
  acceptUrl: string;
}): Promise<void> {
  const body =
    p("Dobrý den,") +
    p(`<strong>${params.inviterName}</strong> vás zve ke správě rezervací pro ordinaci <strong>${params.accountName}</strong>.`) +
    p("Po přijetí pozvánky získáte přístup k rezervačnímu portálu.") +
    note("Pokud tuto pozvánku neočekáváte, odkaz jednoduše ignorujte.") +
    fallbackUrl(params.acceptUrl);

  await send({
    to: params.inviteeEmail,
    subject: `Pozvánka do týmu — ${params.accountName}`,
    html: buildEmail(body, { label: "Přijmout pozvánku", url: params.acceptUrl }),
  });
}
