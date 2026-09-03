# Einstellungen → Darstellung: Marke & Oberfläche

**Datum:** 2026-08-17
**Betroffene Bereiche:** apps/api (`src/settings`), apps/web
(`src/components/settings-form.tsx`, `src/lib/accent-color.ts`,
`src/app/dashboard/layout.tsx`, `src/app/globals.css`,
`src/components/{command-palette,dashboard-header,logo-upload-field,ui/table}.tsx`)

## Was wurde gebaut

Der "Darstellung"-Tab wurde nach Bildvorlage umgebaut: Karte "Marke" (Logo +
Akzentfarbe) und Karte "Oberfläche" (Tabellendichte, Einträge pro Seite –
auf Nutzerwunsch aus der alten "Listen-Ansichten"-Karte hierher verschoben
–, drei Schalter). Genau wie beim "Sicherheit"-Tab wurde alles mit echter
Funktion gebaut, nicht nur Platzhalter.

### Akzentfarbe (das aufwendigste Teilstück)

Die Markenfarbe (`#C8EE44`, Lime) ist in `globals.css` **keine einzelne
Variable**, sondern ~10 voneinander abhängige `oklch()`-Tokens (`--primary`,
`--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`,
`--chart-1`, `--sidebar-primary` + `-foreground`, `--sidebar-accent` +
`-foreground`, `--sidebar-ring`), je einmal für Light- und Dark-Mode. Vor
dem Bauen wurde deshalb gezielt nachgefragt (AskUserQuestion), wie die
Farbwahl technisch funktionieren soll – Antwort: **4 feste Farben laut
Bildvorlage UND ein freier Color-Picker.**

**Lösung** (`lib/accent-color.ts`): aus der gewählten Hex-Farbe wird per
Björn-Ottosson-Formel (Standard-Referenzimplementierung hinter CSS Color
4 `oklch()`) der OKLCH-Farbton (Hue) extrahiert. Für alle abhängigen
Tokens wird **exakt dieselbe Helligkeit/Sättigung ("Form") wie die
bestehende Lime-Palette** übernommen, nur mit dem neuen Farbton – so bleibt
Kontrast/Lesbarkeit für jede beliebige Farbe garantiert, ohne für jede
mögliche Farbe eine eigene, von Hand abgestimmte Palette zu brauchen.
Ausnahme: Eingabefarben mit Helligkeit < 0.5 (z.B. "Navy") würden mit
dieser "immer hell"-Form wie ein blasses Pastell wirken statt wie ein
dunkler Button – für sie greift ein zweiter Ast, der die tatsächliche
(dunkle) Helligkeit der Eingabe für `--primary` übernimmt und die
Vordergrundfarbe auf Hell dreht.

Angewendet wird das Ergebnis über ein serverseitig gerendertes `<style>`-
Tag in `dashboard/layout.tsx` (`buildAccentColorCss()`), das `:root`/
`:root.dark` direkt überschreibt – kein clientseitiges Neu-Berechnen bei
jedem Render, nur bei geänderten Einstellungen. Live end-to-end
getestet: Akzentfarbe auf Blau/Orange gesetzt → gespeichert → gesamte
Oberfläche (Sidebar, Buttons, aktive Tabs, Toggles) färbt sich
konsistent um, per Pixel-/`getComputedStyle()`-Test verifiziert
(`oklch(0.89 0.19 258.701)` für Blau, exakt die erwartete Lime-"Form"
mit neuem Hue).

**Nachtrag (selbiger Tag): Portal-Inhalte blieben zunächst lime.**
Erste Version scopte das `<style>`-Tag auf `#accent-scope` (einen
Wrapper-`<div>` in `dashboard/layout.tsx`) statt auf `:root` – Base-UI-
Portale (Dropdown-Menüs wie `admin-menu.tsx`s "Verwaltung", Tooltips,
Dialoge) rendern ihren Inhalt aber per React-Portal direkt in
`document.body`, außerhalb jedes Wrapper-`<div>`s im Dashboard-Baum.
CSS-Custom-Properties, die nur auf `#accent-scope` gesetzt sind, erreichen
solche Portal-Inhalte nie – sichtbar daran, dass der "Verwaltung"-Header-
Button korrekt blau wurde, das aktive "Benutzer"-Item im aufgeklappten
Dropdown daneben aber lime blieb. **Fix:** Scope auf `:root`/`:root.dark`
geändert – da das `<style>`-Tag ohnehin nur eingebunden ist, während das
Dashboard-Layout gemountet ist, bleibt die Wirkung faktisch genauso
begrenzt wie vorher, erreicht aber zusätzlich jedes Portal. **Regel für
künftige globale Style-Overrides:** nie auf einen bestimmten DOM-Wrapper
scopen, wenn Portal-basierte Komponenten (Dropdown/Dialog/Tooltip/Select)
betroffen sein könnten – `:root` (oder eine Klasse auf `<html>`/`<body>`)
ist der einzig zuverlässige Scope für alles, was per Portal rendert.

Zusätzlich wurden zwei weitere hartcodierte Lime-Stellen gefunden und auf
`bg-primary/…`-Tokens umgestellt, damit auch sie der Akzentfarbe folgen:
`admin-menu.tsx`s aktives Dropdown-Item (war bereits `bg-primary/15`,
aber s.o. vom Portal-Bug betroffen) und `faq-groups-manager.tsx`s
Icon-Box (`iconBgClassName`, war `bg-[#BCE64D]/28`, jetzt `bg-primary/25`).
**Bewusst nicht geändert:** `system-message.tsx` (kanonische, feste
Status-Farben – siehe `toast-and-system-messages.md`), `tag-colors.ts`/
`media-type.ts` (absichtlich variierende Paletten, nicht markenbezogen),
Status-Badges wie "Aktiv"/"Veröffentlicht" (eigenes, festes
grün/rot-System).

**4 feste Presets:** Lime `#C8EE44` (= Standard, `accentColor: null`),
Blau `#93B7EE`, Orange `#E8A33D`, Navy `#151E2E` (Dunkel-Ast) – **plus
ein freier Color-Picker** (natives `<input type="color">`, Nutzervorgabe
"4 vorgegebene Farben laut Screener und eine Color Picker hinzufügen").
Der Paletten-Icon-Button zeigt die gewählte Custom-Farbe als eigenen
Hintergrund (mit automatisch kontrastierendem Icon, hell/dunkel je nach
Helligkeit der Farbe) statt neutral zu bleiben, sobald eine
Nicht-Preset-Farbe aktiv ist. Wirkt nur im Dashboard, nicht auf
Login/Registrierung-Seiten und nicht in System-E-Mails (die "Wirkt im
Backend und in Systemmails."-Unterzeile aus der Bildvorlage wurde deshalb
auf "Wirkt im Backend." gekürzt – E-Mail-Vorlagen sind separates HTML
ohne CSS-Variablen-Zugriff).

### Tabellendichte

`AppSettings.tableDensity: "compact" | "normal" | "airy"`. Statt jede
einzelne Tabellen-Nutzung im Dashboard anzufassen, liest `ui/table.tsx`s
`[data-slot="table-cell"]`/`[data-slot="table-head"]` global über ein
`[data-density]`-Attribut auf dem Dashboard-Wrapper (`globals.css`,
überschreibt nur die vertikale Innenabstand, horizontal bleibt gleich).
Gilt dadurch automatisch für jede Tabelle im Dashboard (Inhalte, Medien,
Benutzer, Rollen, …), ohne einzelne Listen-Seiten anzufassen. Live
verifiziert: Zeilenhöhe Kompakt 85px vs. Luftig 117px auf der echten
Benutzer-Tabelle.

### Seitenleiste eingeklappt starten

`AppSettings.sidebarCollapsedByDefault`. Greift nur als **Fallback**, wenn
noch kein `sidebar_state`-Cookie gesetzt ist (erster Besuch) –
`dashboard/layout.tsx`s bisherige Logik (`sidebarState !== "false"`, immer
"offen" ohne Cookie) wurde entsprechend erweitert. Ein bereits vom Nutzer
selbst gesetztes Cookie hat weiterhin immer Vorrang.

### Tastaturkürzel aktiv

`AppSettings.keyboardShortcutsEnabled`. Deaktiviert **nur** den
Strg/Cmd+K-Tastendruck (`command-palette.tsx`s `keydown`-Listener) – der
klickbare "Strg K"-Badge im Suchfeld bleibt unabhängig davon nutzbar
(bewusste Entscheidung: der Schalter betrifft die Tastenkombination, nicht
die Funktion selbst). **Bewusst nicht mit abgedeckt:** der zweite
bestehende Shortcut Strg+B (Seitenleiste ein-/ausklappen, in
`ui/sidebar.tsx`) – diese Datei ist eine geteilte, App-unabhängige
shadcn-UI-Primitive, die keine `AppSettings` kennen sollte. Wäre eine
spätere, separate Erweiterung.

### Bewegungen reduzieren

`AppSettings.reduceMotion`. `[data-reduce-motion="true"]`-Attribut auf dem
Dashboard-Wrapper, globale CSS-Regel in `globals.css` setzt
`transition-duration`/`animation-duration` auf nahezu 0 für alle
Nachfahren – kein Anfassen einzelner `transition-*`-Klassen nötig.

### Logo-Box (`logo-upload-field.tsx` umgebaut)

War bisher eine 128px-Quadrat-Kachel mit Hover-Overlay-"Ersetzen" + eigenem
`<Label>`. Auf Nutzer-Feedback ("firmenlogo titel muss raus", "die höhe
muss genau gleich sein, auch bei logo", "logo soll höhe 32px breite 100%
haben", "linksbündig und keinen großen abstand zu ersetzen") umgebaut zu
einer kompakten Zeile: 32px hohe, volle Breite einnehmende Vorschau-Fläche
(Inhalt linksbündig statt zentriert, `justify-start` + `w-auto` auf dem
Bild statt `w-full`, sonst wirkt bei einem schmalen Logo in einer breiten
Box der Abstand zum "Ersetzen"-Button unbeabsichtigt riesig) + sichtbarer
"Ersetzen"/"Hinzufügen"-Button + Löschen-Icon – funktional unverändert
(derselbe Upload-/Lösch-Mechanismus), nur die Präsentation an die
"Akzentfarbe"-Box daneben angeglichen (gleiche Höhe, kein doppeltes Label
neben der bereits vorhandenen "LOGO"-Beschriftung der Box selbst).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`AppSettings.accentColor`,
  `tableDensity`, `sidebarCollapsedByDefault`, `keyboardShortcutsEnabled`,
  `reduceMotion`)
- `apps/api/src/settings/dto/update-settings.dto.ts`, `settings.service.ts`
  (`getPublic()`)
- `apps/web/src/lib/accent-color.ts` (neu)
- `apps/web/src/app/dashboard/layout.tsx` (`data-density`/
  `data-reduce-motion`-Wrapper, `<style>`-Injektion, Sidebar-Default-
  Fallback, `keyboardShortcutsEnabled` an `DashboardHeader`)
- `apps/web/src/app/globals.css` (Dichte-/Reduce-Motion-Regeln)
- `apps/web/src/components/command-palette.tsx` (`shortcutsEnabled`-Prop)
- `apps/web/src/components/dashboard-header.tsx` (reicht die Einstellung
  weiter durch)
- `apps/web/src/components/logo-upload-field.tsx` (kompakte Zeilen-Optik)
- `apps/web/src/components/settings-form.tsx` (neue "Marke"/"Oberfläche"-
  Karten; Sidebar-Aktiv-Zustand von hartcodiertem `bg-lime-50`/
  `bg-lime-100 text-lime-700` auf theme-fähiges `bg-primary/15`/
  `bg-primary/25 text-foreground` korrigiert – sonst würde die
  Einstellungs-Sidebar selbst der gewählten Akzentfarbe nicht folgen)
- `apps/web/src/components/faq-groups-manager.tsx` (`iconBgClassName`
  von hartcodiertem Lime-Hex auf `bg-primary/25` korrigiert)
- `apps/web/src/lib/api-server.ts` (`AppSettings`-Interface)

## Offene Punkte

- Kein per-Nutzer-Override – alle "Oberfläche"-Einstellungen sind global,
  obwohl die Bildvorlage "jeder Nutzer kann davon abweichen" andeutet.
  Die entsprechende Unterzeile wurde deshalb auf "Gilt für alle Nutzer im
  Dashboard." angepasst statt eine nicht existierende Funktion zu
  behaupten. Ein echtes Per-Nutzer-Override wäre ein eigenes, größeres
  Ausbaustück (Präferenzen pro `User`-Zeile).
- Strg+B (Seitenleiste) wird vom "Tastaturkürzel aktiv"-Schalter nicht
  erfasst (siehe oben).
- Akzentfarbe wirkt nur im Dashboard, nicht auf Login/Registrierung oder
  in System-E-Mails.


## Update 2026-09-03: Vorschau-Fläche folgt dem Logo, nicht dem Modus

Nutzerhinweis mit Bildvorlage: *"im dunkelmodus muss das feld für das
helle logo heller sein, sonst kann das logo nicht korrekt dargestellt
werden"*. In der dunklen Verwaltung stand das Hellmodus-Logo (dunkel
gezeichnet) auf dunklem Grund und war praktisch unsichtbar.

Die Regel dahinter: **ein Logo ist für genau eine Umgebung gezeichnet.**
Die Vorschau muss deshalb immer die Umgebung zeigen, für die das Logo
gedacht ist – nicht die, in der die Verwaltung gerade läuft. Beide Felder
sind jetzt fest eingefärbt (`bg-white` bzw. `bg-neutral-900` über
`previewClassName`), in beiden Modi gleich. Der Dunkelmodus-Eintrag machte
das schon, dem Hellmodus-Eintrag fehlte das Gegenstück.

Mitgenommen: die Textfarbe gehört zur Fläche. Das Platzhalter-Symbol (noch
kein Logo hochgeladen) stand vorher auf `text-muted-foreground` und war
damit auf der jeweils gegenläufigen Fläche kaum zu sehen – es erbt die
Farbe jetzt vom Container (`currentColor`), die Aufrufer geben sie
zusammen mit dem Grund mit.

**Nicht betroffen:** Favicon und Standard-Social-Media-Bild. Die sind für
keine bestimmte Umgebung gezeichnet und behalten die dem Modus folgende
Standardfläche.


## Update 2026-09-03 (2): Akzentfarbe in mehreren Reihen

Nutzervorgabe mit Bildvorlage: *"akzentfarbe mehrere reihen, so das die
kachel so hoch ist wie logo. nutze mehrere neue farben"*. Die Kachel stand
neben der Logo-Kachel und war mit ihrer einen Reihe halb so hoch.

`ACCENT_PRESETS` umfasst jetzt 26 Farben statt vier – nach der Rückmeldung
*"noch mehr farben bis unten hin"* aufgestockt, bis das Raster die Kachel
füllt. Sortiert nach Farbfamilie (Grün → Türkis → Blau → Violett → Rot →
Orange/Gelb → Neutrale), damit es nicht wie eine Zufallsauswahl wirkt. Sie
brechen in einem `flex-wrap`-Raster um; der Hex-Wert steht per `mt-auto ml-auto` unten rechts statt rechts
neben den Farben. `h-full`/`flex-1` sind von der `FormItem` bis zur Box
durchgereicht, damit die Kachel die Höhe der Logo-Kachel auch dann
mitgeht, wenn die Farben eine Reihe weniger brauchen.

**Nicht beliebig sortierbar:** `ACCENT_PRESETS[0]` ist der Standard – wird
er gewählt, speichert das Formular `null` statt eines Hex-Werts. Lime muss
deshalb vorn bleiben.

Gleichzeitig wurde die Vorschau-Fläche des Hellmodus-Logos von `bg-white`
auf `bg-neutral-200` gesetzt (*"der bg für helles logo dunkler"*) – hell
genug, damit ein dunkles Logo darauf steht, aber kein Leuchtfeld im
dunklen Formular.
