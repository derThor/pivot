# Header-Umbau: Verwaltung-Dropdown, echtes Suchfeld, Systemnachrichten-Glocke

**Datum:** 2026-08-16
**Betroffene Bereiche:** apps/web (`src/components/{dashboard-header,admin-menu,
header-search,command-palette,app-sidebar}.tsx`,
`src/app/dashboard/{layout,system-messages/page}.tsx`)

## Was wurde gebaut

Der Dashboard-Header (`dashboard-header.tsx`) wurde 1:1 nach Bildvorlage
umgebaut:

- **"Verwaltung" ist aus der Sidebar in ein Header-Dropdown gewandert**
  (`admin-menu.tsx`, neue Komponente). Pille mit Icon (`ShieldCheck` statt
  bisher `Wrench` – Nutzervorgabe "anderes Symbol") + Chevron, öffnet ein
  Popover mit "VERWALTUNG"-Label und einem 2-spaltigen Grid: Icon-Kachel +
  Titel + Untertitel je Eintrag (Benutzer/Rollen & Rechte/Websites/
  Webhooks/**Systemnachrichten**, neu). Liest dieselbe
  `navGroups`-Datenquelle aus `app-sidebar.tsx` wie Sidebar/Breadcrumbs/
  Befehlspalette – **keine zweite, separat gepflegte Liste**. Die Sidebar
  rendert die Gruppe "Verwaltung" nicht mehr (`visibleNavGroups` filtert
  sie explizit heraus), `navGroups` selbst bleibt aber unverändert
  vollständig (Breadcrumbs für `/dashboard/users` etc. funktionieren
  dadurch weiter ohne Zusatzaufwand).
- **Echtes, direkt eintippbares Suchfeld** (`header-search.tsx`, neue
  Komponente, ersetzt das gelöschte `global-search.tsx`): dauerhaft
  sichtbare, nicht mehr hover-ausfahrende Box mit Live-Ergebnis-Dropdown
  (debounced `/api/search`, Enter → volle Suchseite). Der "Strg K"-Badge
  rechts im Feld ist ein **eigener** Klick-Ziel-Bereich, der ausschließlich
  die Befehlspalette (`command-palette.tsx`) öffnet – der Rest des Feldes
  ist normale Texteingabe. Dafür wurde `CommandPalette`s `open`-Zustand von
  intern auf optional-kontrolliert umgestellt (`open`/`onOpenChange`-Props,
  Default = eigener State, damit Strg+K weiterhin von überall im Dashboard
  funktioniert auch ohne `header-search.tsx` als Elternteil).
- **Glocke verlinkt auf neue Seite `/dashboard/system-messages`**
  (`SystemMessagesPage`, neu): sammelt an einem Ort, welche der
  `SystemMessage`-Banner aus
  [toast-and-system-messages.md](./toast-and-system-messages.md) gerade
  aktiv wären (Wartungsmodus, Speicherkontingent, Webhook-Fehlschläge) –
  dieselben Komponenten (`StorageQuotaBanner`, `WebhookFailureBanner`)
  wiederverwendet statt dupliziert. Roter Zähler-Badge auf der Glocke
  zählt exakt so viele Karten wie auf der Seite sichtbar sind (nicht nur
  Kategorien, siehe Update unten) – die drei Server-Werte werden in
  `dashboard/layout.tsx` serverseitig berechnet und nur für Nutzer mit
  `settings:manage` abgefragt, um unnötige Requests für alle anderen
  Rollen zu vermeiden.
- **Farb-Korrektur nach Nutzer-Feedback**: alle drei Header-Pillen
  (Verwaltung, Suchfeld, Avatar-Chip) nutzten zunächst `bg-muted` (grau) –
  die Bildvorlage zeigt aber weiße Flächen mit dünnem Rand. Umgestellt auf
  `border bg-card` (siehe Stolpersteine für den Unterschied `--card` vs.
  `--background`/`--muted`).

> **Update 2026-08-16 (Lokale Entwürfe fließen in Glocke + Systemnachrichten-Seite ein):**
> Nutzer-Feedback: der "Nicht gespeicherter Entwurf"-Hinweis im
> Content-Editor tauchte weder in der Glocke noch auf
> `/dashboard/system-messages` auf, obwohl beide denselben
> `SystemMessage`-Look nutzen. Grund: dieser Hinweis ist rein
> `localStorage`-basiert (siehe
> [content-autosave.md](../content/content-autosave.md)) – existiert nur
> in diesem einen Browser, nie auf dem Server bekannt, kann also nicht in
> `dashboard/layout.tsx` (Server Component) mitgezählt werden. Auf
> Nutzerwunsch trotzdem eingebaut, mit explizitem Hinweistext, dass es
> sich um einen rein lokalen, nutzerspezifischen Zustand handelt:
>
> - Neues Modul `lib/local-drafts.ts`: `DRAFT_STORAGE_PREFIX` (aus
>   `content-editor-form.tsx` hierher verschoben, damit Header/
>   Systemnachrichten-Seite nicht die große Editor-Komponente importieren
>   müssen), `listLocalDrafts()` (scannt `localStorage` nach dem Präfix),
>   `notifyLocalDraftsChanged()`/`onLocalDraftsChanged()` – ein
>   Custom-Event fürs Live-Sync **innerhalb desselben Tabs** (der native
>   `storage`-Event feuert nur tab-übergreifend, Header und Editor sitzen
>   aber im selben Tab).
> - `content-editor-form.tsx` ruft `notifyLocalDraftsChanged()` an allen
>   vier Stellen auf, die den Entwurf-`localStorage`-Eintrag verändern
>   (Autosave-Schreiben, Verwerfen, "Änderungen verwerfen", erfolgreiches
>   Speichern).
> - `dashboard-header.tsx`: eigener `useEffect` scannt beim Mount und dann
>   bei jedem `onLocalDraftsChanged`-Event neu, addiert die Trefferzahl **1:1**
>   zum serverseitig berechneten `systemMessageCount`. Die Glocke ist dafür
>   **nicht mehr** hinter `settings:manage` versteckt (anders als der
>   Dropdown-Eintrag) – der Entwurfs-Hinweis betrifft jeden Nutzer, der
>   Inhalte bearbeitet, nicht nur Admins.
> - Neue Komponenten `local-drafts-section.tsx` (rendert einen
>   `SystemMessage`/Entwurf mit "Öffnen"/"Verwerfen"-Aktionen; kein
>   "Öffnen" für Entwürfe zu noch nicht angelegten Inhalten, da deren
>   `localStorage`-Schlüssel keine echte Content-ID enthält) und
>   `system-messages-empty-state.tsx` (das "Alles im grünen Bereich" darf
>   erst rendern, wenn **weder** Server-Meldungen **noch** lokale Entwürfe
>   vorliegen – reiner Client-Check, da der Server die lokalen Entwürfe
>   nicht kennt).
> - **Zähl-Korrektur** (zweites Nutzer-Feedback direkt danach: "ich habe 3
>   Nachrichten, Badge zeigt nur 1"): ursprünglich zählte die Glocke lokale
>   Entwürfe nur als **eine** Kategorie (0/1), obwohl die Seite jeden
>   Entwurf als eigene Karte zeigt. Fix: `localDraftCount` (die tatsächliche
>   Anzahl) statt `localDraftCount > 0 ? 1 : 0` – Badge zeigt jetzt exakt
>   so viele Karten wie tatsächlich sichtbar sind, wie die drei
>   Server-Kategorien (die schon immer je max. 1 Karte waren, daher dort
>   unverändert).

## Warum diese Lösung

- **`navGroups` bleibt einzige Quelle** statt einer zweiten Liste nur für
  den Header: Breadcrumbs, Befehlspalette und jetzt `AdminMenu` sollen
  nicht auseinanderlaufen können, sobald sich mal ein Eintrag ändert.
  Sidebar filtert nur, was sie _rendert_ – die Daten (inkl. `permission`-
  Feld je Item) bleiben vollständig.
- **Kontrollierter `open`-State statt zwei unabhängiger Modals**: Ein
  zweites, eigenständiges Ergebnis-Popup nur für die Kbd-Badge-Aktion hätte
  Suchlogik dupliziert. Die bestehende `CommandPalette` extern öffnen zu
  können war der schlankere Weg, ohne ihre bereits vorhandene Fuzzy-
  Navigation ("Gehe zu", Aktionen) zu verlieren.
- **Systemnachrichten-Seite statt reinem Platzhalter-Link**: anders als
  der bestehende "Websites"-Eintrag (zeigt auf eine noch nicht gebaute
  Route) wurde hier bewusst eine echte, wenn auch einfache Seite gebaut,
  da sonst die neue Glocke mit rotem Zähler-Badge auf nichts Sinnvolles
  verwiesen hätte – eine Badge-Zahl ohne echtes Ziel dahinter wäre
  irreführende UI gewesen.

## Stolpersteine / Besonderheiten

- **`--card` (reines Weiß) vs. `--background`/`--muted` (beide leicht
  grau)**: In diesem Theme ist `--background: oklch(0.985 0 0)` und
  `--muted` ähnlich hell-grau, `--card: oklch(1 0 0)` dagegen echtes Weiß.
  Für freistehende "Pillen" auf dem (leicht grauen) Header-Hintergrund
  braucht es `bg-card` + `border`, sonst verschwimmen sie mit dem
  Hintergrund statt sich klar abzuheben – genau der ursprüngliche
  Bug, den der Nutzer als "weiße Hintergründe" einforderte.
- **`CommandPalette`s Strg+K-Listener braucht `open` in den Effekt-Deps**:
  Nach der Umstellung auf kontrollierten State darf der globale
  `keydown`-Handler nicht mehr `setOpen((prev) => !prev)` (funktionale
  Form) nutzen, da eine von außen übergebene `onOpenChange`-Funktion keine
  Updater-Funktion akzeptiert (nur den neuen Wert). Fix: `setOpen(!open)`
  mit `open` explizit in den `useEffect`-Deps – der Listener wird dadurch
  bei jedem Öffnen/Schließen neu registriert (unproblematisch, da leichtgewichtig).
- **`react-hooks/set-state-in-effect`-Lint-Fehler in `header-search.tsx`
  bereits vorher in `command-palette.tsx` vorhanden** (verifiziert per
  `git stash` + `eslint` auf dem Stand vor dieser Änderung) – kein neu
  eingeführtes Problem, sondern ein bestehendes Muster (`setState`
  synchron im Such-Debounce-Effekt), das beim Portieren der
  Suchfeld-Logik aus dem gelöschten `global-search.tsx` mit übernommen
  wurde. Nicht im Rahmen dieser Änderung behoben (separates Aufräumen,
  betrifft beide Suchkomponenten gleichermaßen).
- **`global-search.tsx` gelöscht**, nicht nur unreferenziert liegen
  gelassen – anders als bei `global-modules-manager.tsx` (siehe
  [faq-and-gallery-dedicated-pages.md](../content/faq-and-gallery-dedicated-pages.md))
  war hier die Ablösung eindeutig und die Komponente klein/isoliert,
  daher direktes Aufräumen statt Nutzer-Rückfrage.

## Relevante Dateien

- `apps/web/src/components/admin-menu.tsx`, `header-search.tsx` (neu)
- `apps/web/src/components/dashboard-header.tsx`, `command-palette.tsx`,
  `app-sidebar.tsx`
- `apps/web/src/app/dashboard/layout.tsx`,
  `dashboard/system-messages/page.tsx` (neu)
- `apps/web/src/components/storage-quota-banner.tsx` (Schwellenwert jetzt
  exportiert, von `layout.tsx` für den Badge-Zähler mitgenutzt)
- `apps/web/src/lib/local-drafts.ts` (neu)
- `apps/web/src/components/local-drafts-section.tsx`,
  `system-messages-empty-state.tsx` (neu)
- `apps/web/src/components/content-editor-form.tsx` (nutzt
  `DRAFT_STORAGE_PREFIX`/`notifyLocalDraftsChanged` aus `lib/local-drafts.ts`
  statt eigener lokaler Konstante)

## Offene Punkte

- Glocken-Badge zählt jetzt exakt die sichtbaren Karten (Server-Kategorien
  je max. 1 + jeder lokale Entwurf einzeln), nicht z.B. die Zahl einzelner
  fehlschlagender Webhooks – bei mehreren fehlschlagenden Webhooks bleibt
  das weiterhin eine gemeinsame Karte/ein Zähler-Punkt.
- "Websites" bleibt weiterhin ein Platzhalter-Link ohne echte Zielseite
  (unverändert, siehe [faq-and-gallery-dedicated-pages.md](../content/faq-and-gallery-dedicated-pages.md)

## Nachtrag 2026-08-17: Nutzer-Dropdown (Avatar oben rechts) nach Bildvorlage umgebaut

Das bisherige Avatar-Dropdown (`dashboard-header.tsx`) war ein einfaches
2-Punkte-Menü ("Konto" / "Abmelden"). Nach Bildvorlage zu einem reichhaltigeren
Panel ausgebaut:

- **Kopfbereich**: großer Avatar + Name + E-Mail.
- **Badges**: **alle** zugewiesenen Rollen (`user.roles.map(...)`, dunkler
  `bg-neutral-900`-Chip – bewusst andere Farbe als die grünen Rollen-Badges
  auf `Mein Konto`/`Benutzer bearbeiten`, da dieses Panel 1:1 der Bildvorlage
  folgt) + `2FA aktiv`/`2FA inaktiv`-Badge (grün/rot, nur wenn
  `allowTwoFactor` global an ist – neuer Prop, aus
  `settings.allowTwoFactor` in `dashboard/layout.tsx` durchgereicht). Zeigte
  anfangs nur `user.roles[0]` (eine Rolle) – Nutzer hatte sich testweise
  mehrere Rollen zugewiesen und sah nur "Administrator"; korrigiert auf
  Anzeige aller zugewiesenen Rollen.
- **Drei Menüpunkte** (Icon in grauer Box + Titel + Unterzeile), alle als
  echte Links: "Mein Konto" → `/dashboard/account`, "Sicherheit & 2FA" →
  `/dashboard/account?tab=security`, "Benachrichtigungen" →
  `/dashboard/account?tab=notifications`. `MyAccountView` liest jetzt einen
  `?tab=`-Query-Parameter (`useSearchParams`) als initialen Tab – Vorrang
  hat weiterhin der bestehende Lockout-Fall (`mustChangePassword`/
  `twoFactorSetupRequired` erzwingt "Sicherheit", auch bei anderem
  Query-Parameter).
- **"Einstellungen"**-Zeile mit Chevron, hinter `settings:read` verborgen
  (gleiche Berechtigungsprüfung wie der Sidebar-Footer-Link in
  `app-sidebar.tsx`).
- **"Abmelden"**: `DropdownMenuItem variant="destructive"` (automatisch rot)
  statt manueller Farbklassen, Icon in `bg-destructive/10`-Box.
- **Fußzeile "Letzte Anmeldung"**: nutzt echtes `user.lastLoginAt` +
  `formatRelativeTime()` (bereits an mehreren Stellen im Projekt
  verwendet). Die Bildvorlage zeigte zusätzlich einen Ort ("· Münster") –
  dafür gibt es **keine Backend-Grundlage** (keine IP-Geolocation, Sessions
  speichern nur User-Agent-Zusammenfassung + Zeitstempel, siehe
  `common/utils/user-agent.ts`), deshalb bewusst weggelassen statt
  erfunden.
- **"3 aktive Regeln"-Unterzeile bei Benachrichtigungen**: es gibt kein
  Regel-basiertes Benachrichtigungssystem (der `Benachrichtigungen`-Tab auf
  `Mein Konto` ist weiterhin ein "in Vorbereitung"-Platzhalter, siehe
  `self-service-auth-flows.md`) – durch eine statische, nicht erfundene
  Unterzeile "Einstellungen & Hinweise" ersetzt (gleiches Muster wie die
  anderen beiden Menüpunkte, die ebenfalls statische Beschreibungen statt
  Live-Zähler zeigen).
- **"Ansicht testen"** aus der Bildvorlage wurde auf Nutzerwunsch
  ausdrücklich **nicht** gebaut (kein entsprechendes Feature vorhanden).
- Chevron rotiert jetzt beim Öffnen (`group-data-popup-open:rotate-180`).

Per Playwright verifiziert: Panel-Layout, Mehrfach-Rollen-Badges, und der
`?tab=security`-Deep-Link (Ziel-Tab tatsächlich aktiv nach Klick).
bzw. ursprünglich `app-sidebar.tsx`).

## Update 2026-08-31: Header-Hintergrund auf 50 %

Nutzervorgabe: "header bg auf 50% setzen". Der klebende Dashboard-Header
lag auf `bg-background/70` und steht jetzt auf `bg-background/50` – der
`backdrop-blur-md` bleibt, darunter durchscrollende Inhalte sind dadurch
etwas deutlicher sichtbar.

## Update 2026-09-05: Dark-Mode-Schalter zieht ins Benutzer-Popup

Nutzervorgabe: _"mach den slider in das popup rechts beim nutzer"_.

Der Schalter stand in der Topbar zwischen den Zählern (Einsendungen,
Meldungen) und dem Benutzer-Knopf. Dort war er ein Fremdkörper: die Zähler
melden Arbeit, der Schalter ist eine persönliche Vorliebe dieses Kontos –
und genau dafür ist das Popup da (Mein Konto, Sicherheit,
Benachrichtigungen).

Er sitzt jetzt als eigene Zeile („Dunkelmodus" links, Schalter rechts)
über der Einstellungen-Zeile. **Bewusst kein `DropdownMenuItem`:** ein
Klick darauf würde das Menü schließen, und man will das Umschalten sehen.

Auf Mobil bleibt es beim zweiten Platz in der Sidebar (`app-sidebar.tsx`) –
dort gibt es das Popup so nicht.
