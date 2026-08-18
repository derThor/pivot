# Firma-Seite unter Verwaltung

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/company-locations`, `src/settings`,
`src/audit-log`), apps/web (`src/app/dashboard/company`,
`src/components/{company-view,company-location-dialog}.tsx`,
`src/components/app-sidebar.tsx`, `src/components/settings-form.tsx`)

## Was wurde gebaut

Die Firmenangaben (bisher unter Einstellungen → Datenschutz, siehe
[settings-page-redesign.md](../frontend/settings-page-redesign.md)) sind
auf Nutzerwunsch ("wir müssen firmen unter verwaltung bringen") auf eine
eigene Seite `/dashboard/company` unter dem Verwaltung-Dropdown
umgezogen ("Firma", zwischen Systemnachrichten und Ende der Liste) – wie
Benutzer/Rollen/Webhooks eine vollwertige eigene Seite, kein
Einstellungs-Unterpunkt mehr. **Es gibt weiterhin nur eine Firma** (kein
Mandanten-/Multi-Firmen-Konzept – explizite Nutzervorgabe).

Die Bildvorlage zeigte deutlich mehr, als real existiert (mehrere
Standorte, Rechtstexte-Tracking mit Auto-Regenerierung, Bank & Steuern,
USt-IdNr.-Prüfung beim Bundeszentralamt, öffentliche
`/impressum`+`/datenschutz`-Seiten, Formular-Footer ohne Formular-Modul,
eine "39 Mitarbeitende"-Firmen-Gesamtzahl ohne echtes
Mitarbeiter-Konzept in der App). Nach Rückfrage (AskUserQuestion) wurde
der Umfang bewusst eingegrenzt:

- **Gebaut:** Kopfkarte, Stammdaten-Tab (bestehende Firmenangaben-Felder +
  neues Feld "Aufsichtsbehörde"), Standorte-Tab (echtes CRUD für mehrere
  Adressen), Vollständigkeits-Anzeige + "Letzte Änderungen" (beide echt,
  siehe unten).
- **Bewusst nicht gebaut:** "Bank & Steuern"-Tab (explizit "komplett
  streichen"), Rechtstexte-Tab (siehe Diskussion unten), "Karte auf
  Kontaktseite einbetten" (referenziert dieselbe nicht existierende
  öffentliche Kontaktseite wie Impressum/Datenschutz), eine
  Firmen-weite "Mitarbeitende"-Gesamtzahl in der Kopfkarte (kein echtes
  Konzept – nur pro Standort ist es ein manuell eingegebenes Feld, siehe
  unten).

### Rechtstexte-Tab: bewusst nicht gebaut, mit Begründung

Erste Version der Bildvorlage zeigte "Rechtstexte automatisch
nachziehen" als reinen Hintergrund-Trigger – der Nutzer hinterfragte das
zu Recht ("wie sollen die denn aktualisiert werden? wenn ich ein neues
Dokument anlege oder bearbeite, ist das doch gleich aktuell?"). Eine
zweite, detailliertere Bildvorlage zeigte danach ein tatsächlich
kohärentes Konzept (Rechtstexte werden aus den Stammdaten generiert,
"Firmendaten geändert" = Stammdaten wurden nach der letzten Generierung
bearbeitet, manuelle Ergänzungen bleiben bei Neu-Erzeugung erhalten,
"Pflichtangaben-Check" prüft nur Feld-Vollständigkeit). Das wäre real
umsetzbar (z.B. durch Wiederverwendung des bestehenden `Content`-Modells
für die eigentlichen Texte + echte `/impressum` usw. Routen), ist aber
ein eigenständiges, noch nicht begonnenes Feature-Projekt (Template-
Generierung, Teil-Regenerierung unter Erhalt manueller Ergänzungen,
Staleness-Erkennung, 5 neue öffentliche Routen) – in dieser Session nicht
umgesetzt, um den bereits sehr großen Umfang dieser Seite nicht
unbegrenzt auszudehnen.

### Standorte (`CompanyLocation`, neues Modell)

Einfaches CRUD (`company-locations`-Modul, Berechtigung `settings:read`/
`-update`, dieselbe wie die übrigen Firmenangaben). Genau ein Standort
kann gleichzeitig "Hauptsitz" sein (`isPrimary`, beim Setzen wird der
vorherige automatisch zurückgesetzt). `employeeCount` ("Mitarbeitende")
ist ein **manuell vom Admin eingegebenes** optionales Zahlenfeld pro
Standort – keine echte Mitarbeiterverwaltung, aber auch kein erfundener,
automatisch berechneter Wert (Admin tippt die Zahl selbst ein, wie jedes
andere Feld). Standorte ohne Anschrift (z.B. "Homeoffice-Standort")
zeigen "– · verteilt" statt leerer Adressfelder.

Liste+Detail-Layout (links Liste mit Bearbeiten-/Löschen-Icons, rechts
Detail-Karte des ausgewählten Standorts + "Standort bearbeiten"-Button) –
gleiches Grundmuster wie `roles-explorer.tsx`/`navigation-explorer.tsx`.

**Hydration-Bug beim ersten Bauen:** die Zeile war ursprünglich ein
`<button>`, das die Bearbeiten-/Löschen-`<Button>`-Elemente als Kinder
enthielt – ungültiges HTML (`<button>` in `<button>`), React meldete
einen Hydration-Fehler in der Konsole. Fix: äußere Zeile ist jetzt ein
`<div>`, nur der linke, auswählbare Teil (Icon+Name+Adresse) ist ein
eigenes `<button>`, Bearbeiten/Löschen sind Geschwister-Elemente
außerhalb davon. **Lehre:** bei "ganze Zeile klickbar + einzelne Aktions-
Icons in derselben Zeile"-Mustern nie die ganze Zeile als `<button>`
bauen, wenn echte `<Button>`-Elemente darin vorkommen – immer den
klickbaren Teil separat verschachteln.

### Vollständigkeits-Anzeige + "Letzte Änderungen" (beide echt)

- **Vollständigkeit**: reine Client-Berechnung (`filledCount /
  companyFields.length`), keine Backend-Änderung nötig – Fortschrittsbalken
  + `<SystemMessage variant="success">`("Alle Pflichtfelder gefüllt.")
  bzw. `variant="warning">` ("N Felder fehlen noch.") je nach Vollständigkeit
  (kanonische Farben, siehe `toast-and-system-messages.md`).
- **Letzte Änderungen**: echte Feld-Ebene-Audit-Einträge, neue Nutzung des
  bestehenden `AuditLogService` (siehe
  [user-activity-log.md](user-activity-log.md)) – `SettingsService.update()`
  vergleicht jedes der 12 Firmenfelder vor/nach dem Patch und schreibt pro
  tatsächlich geändertem Feld einen eigenen `company.field_updated`-Eintrag
  (`entityType: "Company", entityId: "company"`, `metadata: {field,
  wasEmpty}`). Neue `AuditLogService.findRecentForEntity()`-Methode (akteur-
  unabhängig, anders als `findForUser()`) + neuer Endpunkt `GET
  /settings/company/changes`. Zeigt echten Namen, echtes Datum, "ergänzt"
  (Feld war vorher leer) vs. "aktualisiert" (Feld hatte bereits einen Wert)
  – 1:1 nach Bildvorlage, timeline-Look wie im bestehenden
  Aktivität-Tab (Punkt+Linie, neuester Eintrag lime, ältere grau).

## Aufräumarbeiten in `settings-form.tsx`

Die komplette Firmenangaben-Karte (Felder-Grid, `companyFields`-Array,
`companyValues`-State, `defaultCompanyValues`) wurde aus dem
"Datenschutz"-Tab entfernt – **wichtig:** auch aus dem
`onSubmit()`-PATCH-Payload (`...companyValues` gestrichen), sonst hätte
jedes Speichern der übrigen Einstellungen (Sicherheit, Darstellung, …)
die jetzt auf der neuen Firma-Seite gepflegten Firmenfelder unbemerkt mit
leeren Strings überschrieben. Übrig bleibt im Datenschutz-Tab nur die
ehrliche Platzhalter-Karte "Aufbewahrung, Cookies & AV" mit einem Hinweis
auf den neuen Ort der Firmenangaben.

## Relevante Dateien

- `packages/database/prisma/schema.prisma`
  (`AppSettings.companySupervisoryAuthority`, neues `CompanyLocation`)
- `apps/api/src/company-locations/*` (neu)
- `apps/api/src/settings/settings.service.ts` (`update()` mit Diff-Logging,
  `getCompanyChanges()`), `settings.controller.ts` (`GET
  /settings/company/changes`, `update()` erhält jetzt `@CurrentUser()`)
- `apps/api/src/audit-log/audit-log.service.ts` (`findRecentForEntity()`)
- `apps/web/src/app/dashboard/company/page.tsx` (neu)
- `apps/web/src/components/company-view.tsx`,
  `company-location-dialog.tsx` (neu)
- `apps/web/src/components/app-sidebar.tsx` ("Firma"-Eintrag)
- `apps/web/src/components/settings-form.tsx` (Firmenangaben-Karte entfernt)
- `apps/web/src/lib/api-server.ts` (`CompanyLocation`, `CompanyChange`,
  `getCompanyLocations()`, `getCompanyChanges()`)

## Offene Punkte

- Rechtstexte-Tab (siehe oben) – eigenes, separates Vorhaben.
- Bank & Steuern – explizit gestrichen, kein Wiederaufnahme-Plan.
- Keine Firmen-weite Mitarbeitende-Gesamtzahl in der Kopfkarte (nur pro
  Standort, siehe oben).
