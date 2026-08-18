# Seiten-Übersicht & Content-Editor: Redesign

**Stand: 2026-08-18**

## Seiten-Übersicht (`/dashboard/content`)

1:1 nach Bildvorlage neu gebaut:

- 4 Statistik-Kacheln (Seiten gesamt/Veröffentlicht/Entwürfe/Geplant) –
  Zahlen über vier parallele `getContentList({status, pageSize: 1})`-
  Aufrufe (`.meta.total`), exakt dasselbe Muster wie die
  "Statusverteilung"-Kachel auf dem Dashboard.
- Tabelle **ohne Massenauswahl** (Nutzerentscheidung, 2026-08-18, nach
  Rückfrage: die Bildvorlage zeigt keine Checkboxen) – bewusste
  Ausnahme von der sonst app-weiten Checkbox+Sammel-Löschen-Konvention
  (siehe [bulk-selection-and-delete.md](../frontend/bulk-selection-and-delete.md)).
- Spalten geändert: `Typ`/`Kategorien` entfernt, dafür `Pfad` (Slug,
  monospace) und `Abschnitte` (`N Bausteine`) neu.
- Neues Feld `ContentListItem.sectionsCount`: backend-seitig in
  `ContentService.findAll()` per `countSections()`-Heuristik aus dem
  schema-losen `Content.data`-JSON ermittelt (findet ein Array-Feld,
  bevorzugt eins mit block-artigen Einträgen `{type: ...}`, sonst das
  erste gefundene Array) – ohne zusätzlich das volle `ContentType.schema`
  laden zu müssen. Absichtlich nur eine Heuristik, kein exaktes
  Schema-Matching; für die reine Anzeige-Kachel ausreichend genau.
- `formatRelativeTime()` (`lib/utils.ts`) app-weit um "vor N Wochen"/
  "vor N Monaten" erweitert (vorher: ab 7 Tagen sofort absolutes Datum)
  – wirkt jetzt auch auf Benutzerliste/Konto-Seite/Header, nicht nur
  hier.
- Gemeinsame `StatCard`-Komponente (`components/stat-card.tsx`)
  extrahiert – vorher dreimal identisch dupliziert (Datenschutz,
  Papierkorb, jetzt Seiten-Übersicht).

## Content-Editor (`content-editor-form.tsx`)

Nur noch **zwei Tabs** statt drei (Nutzervorgabe, 2026-08-18: "Seite
anlegen, bearbeiten: nur noch 2 Tabs. Einstellungen und SEO
zusammenlegen"): `settingsSeo` (zusammengelegt) + `design` (nur bei
Content-Types mit `modules`-Feld). Der Wizard-Modus beim Neuanlegen
(`isWizard`/`maxWizardStepIndex`, siehe ursprüngliche
[content-editor-dynamic-forms.md](./content-editor-dynamic-forms.md))
funktioniert unverändert, nur mit den neuen, kürzeren `wizardSteps`
(`["settingsSeo", "design"]` bzw. nur `["settingsSeo"]` ohne
Modul-Feld – dann gibt es auch keinen "Weiter"-Button mehr, direkt
Speichern).

- `settingsSeo`-Tab: zwei **unabhängige** Kachel-Spalten
  (`grid-cols-2 items-start` – `items-start` ist Pflicht, sonst
  strecken sich beide Karten auf die Höhe der jeweils größeren, siehe
  [card-shadow-convention]). Links: Content-Type/Titel/Slug/Status/
  Kategorien (+ dynamische Content-Type-Felder, + Richtext-Editor
  darunter gestapelt, falls der Content-Type ein direktes `richtext`-
  Feld hat statt `modules, z.B. Content-Type "Rich-Text"). Rechts: SEO
  & Sichtbarkeit (Card mit Icon+Titel-Header) + OpenGraph & Twitter-
  Card als zweite Karte darunter. **Kein** umschließendes Karten-
  Element um beide Spalten (`PageContent plain` statt Default) – sonst
  entsteht eine dritte, unerwünschte "Hintergrund-Kachel" um die beiden
  eigentlichen Karten (wiederholt aufgetretener Fehler diese Sitzung,
  siehe [ui-convention-crud-and-delete-confirmation.md]).
- Status-Feld: von `Select`-Dropdown auf `SegmentedPicker` umgestellt
  (`components/segmented-picker.tsx`, bereits für Aufbewahrungsfristen
  genutzt). Neuer optionaler `variant="dark"`-Prop dafür (dunkle statt
  weiße aktive Pille, 1:1 nach Bildvorlage) – Default bleibt `"light"`,
  wirkt sich nicht auf die bestehenden Verwendungsstellen aus. Beim
  Neuanlegen nur 3 Optionen (Entwurf/Veröffentlicht/Geplant, kein
  "Archiviert" – ergibt beim Erstellen keinen Sinn), beim Bearbeiten
  alle 4. `SegmentedPicker.label` außerdem optional gemacht (leer
  lassen, wenn – wie hier – bereits ein eigenes `FormLabel` darüber
  steht).
- Kategorien-Auswahl (Select + entfernbare Badges) bewusst unverändert
  gelassen (Nutzervorgabe: "soll so bleiben, wie jetzt").

## Stolperstein: `CardHeader` ist `display: grid`, nicht `flex`

Icon-Box + Titel in der SEO-Karte sollten nebeneinander in einer Zeile
stehen. `className="flex-row items-center gap-3"` allein reichte
nicht – `CardHeader` aus `ui/card.tsx` ist von Haus aus `grid`, ein
reines `flex-row` ohne `flex` (display) bleibt wirkungslos und die
Kinder stapeln sich weiterhin über `auto-rows-min`. Fix: `className="flex
flex-row items-center gap-3 border-b"` (das `border-b` sorgt zusätzlich
automatisch für den passenden Trennstrich + Innenabstand, siehe
`[.border-b]:pb-(--card-spacing)` in `CardHeader`).
