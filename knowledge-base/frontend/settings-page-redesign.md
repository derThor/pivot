# Einstellungsseite: neue Sidebar-Navigation nach Bildvorlage

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/web (`src/components/settings-form.tsx`,
`src/app/dashboard/settings/page.tsx`)

## Was wurde gebaut

Die Einstellungsseite (`/dashboard/settings`) hatte bisher eine horizontale
`Tabs`-Leiste mit 4 Reitern (Firma, Zugriff & Funktionen, Sicherheit,
Darstellung). Nach Bildvorlage komplett umgebaut auf eine linke
Sidebar-Navigation mit 7 Bereichen, exakt im Layout-Muster von
`navigation-explorer.tsx` (Menüs-Seite): ein `rounded-xl border-[#E5E5E5]`-
Container, darin die Einträge per `divide-y divide-[#F0F0F0]` getrennt,
**volle Breite pro Zeile** (kein einzelner Rahmen/keine Rundung pro Item,
kein Innenabstand am Container – erste/letzte Zeile schließt bündig mit
den abgerundeten Ecken ab), aktive Zeile mit `border-l-4 border-l-primary
bg-lime-50` (linker grüner Akzentbalken + lime Hintergrund), Hover auf
inaktiven Zeilen als `hover:bg-muted/50`-Balken über die volle Breite.

**Erste Version hatte einzeln umrandete, abgerundete Boxen pro Sidebar-
Eintrag (mit `p-2`-Außenabstand am Container)** – auf Nutzer-Feedback
("hover voll durchgehen, links grüner balken", "erstes und letztes
element kein weisser rand nach oben und unten") auf das oben beschriebene
volle-Breite-Muster korrigiert, das dem bereits bestehenden
`navigation-explorer.tsx`-Sidebar-Muster entspricht.

Jeder Eintrag: Icon in einer `rounded-lg`-Box (aktiv: `bg-lime-100
text-lime-700`, inaktiv: `bg-[#F4F4F5] text-muted-foreground`) + Titel +
graue Unterzeile. Icons (lucide-react): `Menu` (Zugriff & Funktionen),
`Shield` (Sicherheit), `Contrast` (Darstellung), `Plug` (Integrationen),
`Lock` (Datenschutz), `Bell` (Benachrichtigungen), `History` (Protokoll).

Kopfbereich (Titel + Breadcrumb + "Verwerfen"/"Speichern") 1:1 nach
Bildvorlage in `SettingsForm` verlagert (vorher `PageHeader` in
`page.tsx` + ein einzelner "Einstellungen speichern"-Button unten). Neuer
"Verwerfen"-Button: `form.reset(defaultValues)` + Zurücksetzen der lokal
gehaltenen Firmenfelder/Speicherkontingent-States auf die ursprünglich
geladenen Werte. Bestehende Umschalter-Zeilen (`SwitchRow` und die
manuellen Zeilen für Mindestlänge/Speicherkontingent/Cache/Einträge pro
Seite) auf dieselbe umrandete Box-Optik (`rounded-lg border-[#F0F0F0]
bg-[#FAFAFA] p-4`) umgestellt wie die Modul-Zeilen der Bildvorlage.

## Bewusst nicht wie in der Bildvorlage gebaut (kein erfundener Wert)

Die Bildvorlage zeigt für "Zugriff & Funktionen" eine **Modul-Ein/Aus-
Liste** ("Module & Erweiterungen": Formulare, Galerien, FAQs,
Vorschau-Links, Webhooks, Systemnachrichten, Mehrsprachigkeit, je mit
Versions-Badge) sowie einen "Redaktionsablauf"-Bereich (Freigabe vor
Veröffentlichung, Kommentare an Entwürfen, …). **Beides existiert nicht
als echtes Feature** – es gibt keine modul-weisen Aktivierungs-Flags
(Formulare sind ohnehin kein gebautes Modul in dieser App) und keinen
Freigabe-/Approval-Workflow (siehe `docs/ROADMAP.md`, Phase 2b.9
"Workflow", weiterhin offen). Der Bereich "Zugriff & Funktionen" zeigt
stattdessen weiterhin die **echten** bestehenden Selbstbedienungs-
Schalter (Registrierung, Passwort-Reset, E-Mail-Änderung,
Admin-Freischaltung, Autosave, Bildvarianten, Wartungsmodus,
Speicherkontingent, Cache leeren).

**"NEU"-Badges bewusst weggelassen** (Nutzervorgabe: "ohne neu batch").

**Bestehende Inhalte neu einsortiert:**
- "Firma" (bisher eigener Tab) → jetzt unter **Datenschutz**
  (Firmenangaben fürs Impressum passen inhaltlich besser dorthin als zu
  einem eigenen Tab).
- Firmenlogo-Upload → jetzt unter **Darstellung** (passt zur
  Bildvorlage-Unterzeile "Logo, Akzentfarbe, Dichte").
- Passwort-Richtlinie + 2FA → unverändert unter **Sicherheit**.
- "Einträge pro Seite" → unverändert unter **Darstellung**.

**Vier Bereiche sind reine, ehrliche Platzhalter-Karten** (gleiche
Konvention wie die Darstellung-/Benachrichtigungen-Tabs auf "Mein
Konto" – kein erfundener Inhalt, nur eine Notiz):
- **Integrationen** ("API-Schlüssel, Dienste") – kein API-Key-Management
  vorhanden; Hinweis, dass bestehende Webhooks weiterhin über die eigene
  Webhooks-Seite verwaltet werden.
- **Akzentfarbe & Dichte** (innerhalb Darstellung) – kein Farbschema/keine
  kompakte Listendarstellung vorhanden.
- **Datenschutz-Zusatz** ("Aufbewahrung, Cookies, AV") – keine
  Aufbewahrungsfristen-/Cookie-Consent-/AV-Verwaltung vorhanden.
- **Benachrichtigungen** ("Absender & Systemmails") – kein
  SMTP-Absender-Konfigurationsfeature vorhanden. Hinweis, dass die
  bestehenden `notify*`-Kategorie-Schalter weiterhin auf der Seite
  "Systemnachrichten" liegen (`NotificationSettingsCard`, nicht hierher
  verschoben, um den bestehenden Ort nicht ohne Absprache zu ändern).
- **Protokoll** ("Änderungen & Export") – kein übergreifender,
  exportierbarer Audit-Log über alle Benutzer; Hinweis auf den bereits
  gebauten Aktivität-Tab pro Benutzer (siehe
  [user-activity-log.md](../auth/user-activity-log.md)), der als
  natürliche Grundlage für eine spätere globale Protokoll-Ansicht dienen
  könnte.

## Relevante Dateien

- `apps/web/src/components/settings-form.tsx` (komplett neu strukturiert)
- `apps/web/src/app/dashboard/settings/page.tsx` (kein `PageHeader` mehr,
  Header lebt jetzt in `SettingsForm`)

## Offene Punkte

- Inhalte für Integrationen, Datenschutz-Zusatz, Benachrichtigungen und
  Protokoll folgen als eigene, spätere Ausbauschritte (jeweils eigene
  Rückfrage nötig, da diese Bereiche echte neue Backend-Features
  bräuchten, nicht nur UI).
- Kein Playwright-Test für den "Verwerfen"-Button auf die
  Firmenfelder/Speicherkontingent (nur der Switch-Reset wurde end-to-end
  verifiziert; die lokalen String-States nutzen dieselbe
  `handleDiscard()`-Funktion, Logik ist aber ungetestet).
