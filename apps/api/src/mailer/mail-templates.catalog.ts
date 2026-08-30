// Standard-Wortlaut + Metadaten der acht System-Mails, die einen festen,
// vorlagen-fähigen Text haben (siehe mailer.service.ts). Zwei bestehende
// Mail-Methoden bleiben bewusst AUSSER dieser Liste, weil ihr Inhalt schon
// vollständig dynamisch ist – eine "Vorlage" hätte dort nichts, das über
// den Aufrufer hinaus als fester Standard existiert:
// - sendDeletionRequestFollowUp: der Admin tippt die Rückfrage frei im
//   Popup, es gibt keinen Standardtext zum Bearbeiten.
// - sendSystemNotificationEmail: Titel/Text kommen bereits fertig
//   formuliert aus NotificationsService (z.B. "Speicherplatz wird knapp").
//
// Kein DB-Row wird vorab geseedet (bewusst anders als im Plan zunächst
// skizziert): `MailTemplate` bleibt leer, bis jemand über Mailing etwas
// bearbeitet – ohne eigene Zeile liefert `renderSystemTemplate()` genau
// diesen Standardtext zurück. "Auf Standard zurücksetzen" ist damit
// einfach: DB-Zeile löschen.
export type MailTemplateCategory = 'auth' | 'privacy' | 'forms';

export interface SystemMailTemplateDefault {
  key: string;
  category: MailTemplateCategory;
  label: string;
  placeholders: string[];
  // Nur bei Vorlagen mit editierbarem Empfänger true (siehe
  // MailTemplate.recipientTo-Kommentar in schema.prisma) – alle
  // System-Mails hier haben einen kontextabhängigen, fest bestimmten
  // Empfänger, daher überall false.
  recipientEditable: boolean;
  subject: string;
  body: string;
}

export const SYSTEM_MAIL_TEMPLATES: SystemMailTemplateDefault[] = [
  {
    key: 'auth.verify-email',
    category: 'auth',
    label: 'E-Mail-Adresse bestätigen',
    placeholders: ['link'],
    recipientEditable: false,
    subject: 'Bestätige deine E-Mail-Adresse',
    body: 'Bitte bestätige deine E-Mail-Adresse über folgenden Link: {{link}}',
  },
  {
    key: 'auth.password-reset',
    category: 'auth',
    label: 'Passwort zurücksetzen',
    placeholders: ['link'],
    recipientEditable: false,
    subject: 'Passwort zurücksetzen',
    body: 'Setze dein Passwort über folgenden Link zurück: {{link}}',
  },
  {
    key: 'privacy.dpo-incident-notification',
    category: 'privacy',
    label: 'Datenschutzvorfall-Benachrichtigung',
    placeholders: ['title', 'severity'],
    recipientEditable: false,
    subject: 'Neuer Datenschutzvorfall: {{title}}',
    body: 'Es wurde ein neuer Datenschutzvorfall erfasst: „{{title}}“ (Schweregrad: {{severity}}).',
  },
  {
    key: 'privacy.dpo-monthly-report',
    category: 'privacy',
    label: 'Monatsbericht Datenschutz',
    placeholders: ['rows'],
    recipientEditable: false,
    subject: 'Monatsbericht Datenschutz',
    body: 'Im Anhang findest du den aktuellen Datenschutz-Monatsbericht ({{rows}} Kennzahlen).',
  },
  {
    key: 'privacy.subject-access-report',
    category: 'privacy',
    label: 'Auskunft nach Art. 15 DSGVO',
    placeholders: ['rows'],
    recipientEditable: false,
    subject: 'Ihre Auskunft nach Art. 15 DSGVO',
    body: 'Im Anhang finden Sie Ihre Auskunft nach Art. 15 DSGVO ({{rows}} Zeilen).',
  },
  {
    key: 'privacy.deletion-request-acknowledgement',
    category: 'privacy',
    label: 'Eingangsbestätigung Betroffenenanfrage',
    placeholders: ['dsrId'],
    recipientEditable: false,
    subject: 'Eingang Ihrer Anfrage bestätigt',
    body: 'Wir haben Ihre Anfrage ({{dsrId}}) erhalten und bearbeiten sie zeitnah.',
  },
  {
    key: 'privacy.deletion-request-deadline-reminder',
    category: 'privacy',
    label: 'Fristerinnerung Betroffenenanfrage',
    placeholders: ['dsrId', 'dueAt'],
    recipientEditable: false,
    subject: 'Frist läuft bald ab: Anfrage {{dsrId}}',
    body: 'Die Frist für die Anfrage {{dsrId}} läuft am {{dueAt}} ab.',
  },
  {
    key: 'privacy.data-processor-contract-request',
    category: 'privacy',
    label: 'AV-Vertrag anfordern',
    placeholders: ['processorName'],
    recipientEditable: false,
    subject: 'Anfrage AV-Vertrag',
    body: 'Wir bitten um Zusendung des Auftragsverarbeitungsvertrags für "{{processorName}}".',
  },
];

// E-Mail-Templates (Hüllen) – Kopf/Fuß/CI, in die der Klartext-Inhalt
// jeder Vorlage eingesetzt wird (siehe MailerService.wrapInShell/
// plainTextToHtml). Gleiches `{{...}}`-Platzhalter-Muster wie überall
// sonst im Mailing (siehe MailerService.renderPlaceholders).
export const MAIL_SHELL_CONTENT_PLACEHOLDER = '{{content}}';

export function hasShellContentPlaceholder(html: string): boolean {
  return html.includes(MAIL_SHELL_CONTENT_PLACEHOLDER);
}

export type FormMailKind = 'admin_notification' | 'confirmation';

interface FormLike {
  name: string;
  fields: unknown;
}

/** Formular-Feld-Ids sind die stabilen Platzhalter-Namen (siehe
 * `Form.fields`-Kommentar in schema.prisma) – der Standardtext listet
 * jedes Feld als `Label: {{id}}`-Zeile auf. */
export function formFieldPlaceholders(fields: unknown): string[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter(
      (f) =>
        f &&
        typeof f === 'object' &&
        (f as { type?: unknown }).type !== 'section',
    )
    .map((f) => (f as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
}

/** Feld-Id → Feld-Label, für die Platzhalter-Tooltips im Mailing-Editor
 * (Nutzervorgabe: dort muss der echte Feld-Name stehen, nicht ein
 * generischer Platzhaltertext). */
export function formFieldLabels(fields: unknown): Record<string, string> {
  if (!Array.isArray(fields)) return {};
  const labels: Record<string, string> = {};
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const { id, label, type } = f as {
      id?: unknown;
      label?: unknown;
      type?: unknown;
    };
    if (type === 'section' || typeof id !== 'string') continue;
    if (typeof label === 'string' && label.trim()) {
      labels[id] = label;
    }
  }
  return labels;
}

export function defaultFormTemplate(form: FormLike, kind: FormMailKind) {
  const fields = Array.isArray(form.fields)
    ? (form.fields as Array<{ id: string; label: string; type?: string }>)
    : [];
  // "section"-Felder sind rein darstellend (Titel + Hinweistext, kein
  // Eingabewert) – hätten hier nur eine leere `{{id}}`-Zeile ergeben.
  const fieldLines = fields
    .filter((f) => f.type !== 'section')
    .map((f) => `${f.label}: {{${f.id}}}`)
    .join('\n');
  if (kind === 'admin_notification') {
    return {
      subject: 'Neue Einsendung: {{formName}}',
      body: `Es gibt eine neue Einsendung im Formular "{{formName}}" ({{submittedAt}}).\n\n${fieldLines}`,
    };
  }
  return {
    subject: 'Ihre Nachricht ist bei uns eingegangen',
    body: `Vielen Dank für Ihre Nachricht über unser Formular "{{formName}}". Wir melden uns zeitnah bei Ihnen.\n\nIhre Angaben:\n${fieldLines}`,
  };
}
