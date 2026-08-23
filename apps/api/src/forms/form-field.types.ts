// Feld-Typ-Katalog für `Form.fields` (siehe Plan) – bewusst ein eigener,
// von `ContentTypeField` (content-types/Seiten-Designer) unabhängiger
// Katalog, da Formulare andere Typen brauchen (email/tel/select/radio/
// checkbox/date) und keinen Bezug zu Repeatern/Modulen haben.
export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'tel',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'file',
  // Rein darstellend (Titel + Hinweistext, kein Eingabewert) – gliedert
  // längere Formulare optisch, siehe FormsService.submit() (übersprungen
  // bei der Pflichtfeld-Prüfung) und form-block-render.tsx (kein Input).
  'section',
  // Einzelne Einwilligungs-Checkbox (z.B. "Ich akzeptiere die
  // Datenschutzerklärung") – boolescher Wert, `label` ist der
  // Einwilligungstext selbst (kein separates Titel-Label darüber, siehe
  // form-block-render.tsx). Bei `required: true` prüft
  // FormsService.submit() explizit auf `value === true`, da eine
  // ungesetzte Checkbox (`false`) sonst die generische
  // Pflichtfeld-Prüfung nicht auslösen würde.
  'privacy_notice',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

// Typen mit `options: string[]` (Auswahl-Gruppe im Feld-Builder).
export const FORM_FIELD_TYPES_WITH_OPTIONS: FormFieldType[] = [
  'select',
  'radio',
  'checkbox',
];

export interface FormField {
  // Stabile Feld-Id = Platzhalter-Name in den Mail-Vorlagen dieses
  // Formulars (z.B. {{name}}), siehe schema.prisma-Kommentar auf `Form`.
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  // Prozentuale Breite (10-100), per Zieh-Griff im Feld-Builder gesetzt –
  // gleiche Konvention wie `ImageFieldValue.width` im Seiten-Designer
  // (block-editor-field.tsx). 100 = volle Breite, kleinere Werte reihen
  // mehrere Felder per `flex-wrap` nebeneinander ein.
  width: number;
  options?: string[];
  // Nur für `type: "radio"`/`"checkbox"` relevant: Anordnung der
  // Optionen. `undefined` = "vertical" (bisheriges Standardverhalten).
  optionsLayout?: 'vertical' | 'horizontal';
  // Optionaler Untertext (bei `type: "section"` der eigentliche Inhalt,
  // bei allen anderen Typen eine kleine Hilfestellung unter dem Titel).
  helpText?: string;
  // `undefined`/`true` = Titel sichtbar (bisheriges Standardverhalten),
  // `false` blendet nur das Label aus – Pflicht-Stern/Hinweistext/Eingabe
  // bleiben unverändert bestehen.
  showLabel?: boolean;
  // Nur für `type: "privacy_notice"`: Verlinkung auf eine bestehende
  // Content-Seite (z.B. die generierte Datenschutzerklärung), per Dropdown
  // im Eigenschaften-Panel gewählt. Bewusst als Snapshot (Slug+Titel)
  // statt Live-Auflösung über eine Content-Id gespeichert – gleiche
  // Konvention wie z.B. `ImageFieldValue`, keine zusätzliche
  // Backend-Verknüpfung nötig. Wird die Zielseite später umbenannt/
  // verschoben, muss die Verlinkung im Formular-Editor neu gesetzt werden.
  privacyPageSlug?: string;
  privacyPageTitle?: string;
}
