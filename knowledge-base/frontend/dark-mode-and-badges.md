# Dark Mode & kanonisches Badge-System

**Stand:** 2026-08-27, geschrieben anhand des aktuellen Codes (nicht aus
Chatverlauf rekonstruiert – frühere Teile dieser Arbeit liefen in einer
Session, deren Chatverlauf nicht mehr vollständig vorliegt; diese Doku
beschreibt bewusst nur, was im Code tatsächlich steht).

**Betroffene Dateien:** `apps/web/src/app/globals.css`,
`apps/web/src/app/layout.tsx`, `apps/web/src/components/theme-toggle.tsx`,
`apps/web/src/components/ui/badge.tsx`,
`apps/web/src/components/ui/system-message.tsx`,
`apps/web/src/lib/role-colors.ts`, `apps/web/src/lib/website-status.ts`,
`apps/web/src/lib/deployment-mode-badge.ts`, `apps/web/src/lib/search.ts`.

## Umschalt-Mechanismus

Dark Mode hängt an einem **Attribut auf `<html>`**
(`data-pivot-theme="dark"`), nicht an einer `.dark`-Klasse:

```css
@custom-variant dark (&:is([data-pivot-theme="dark"] *));
```

Dadurch funktionieren alle bestehenden Tailwind-`dark:`-Utility-Klassen im
restlichen Code unverändert (z.B. in `system-message.tsx`), ohne dass eine
Migration auf ein neues Präfix nötig war.

**Kein Flackern beim Laden**: ein blockierendes Inline-`<script>` als
erstes Element in `<head>` (`layout.tsx`) liest `localStorage` synchron
vor dem ersten Paint und setzt das Attribut sofort:

```js
try{if(localStorage.getItem('pivot-theme')==='dark'){document.documentElement.setAttribute('data-pivot-theme','dark');}}catch(e){}
```

`<html>` trägt zusätzlich `suppressHydrationWarning`, da das
serverseitige Markup dieses clientseitig gesetzte Attribut naturgemäß nie
kennt.

**`ThemeToggle`** (`theme-toggle.tsx`) hält den Zustand bewusst NICHT als
alleinige React-State-Quelle, sondern liest ihn per `useEffect` einmalig
nach dem Mount aus dem bereits vom Blocking-Script gesetzten DOM-Zustand
(Server- und erster Client-Render bleiben dadurch identisch, kein
Hydration-Mismatch). Beim Klick: `setAttribute`/`removeAttribute` auf
`document.documentElement` + `localStorage.setItem`. Exakte Geometrie:
Track 82×36px (`h-9 w-[82px]`), Knopf 28px (`size-7`), Label "LIGHT"/"DARK"
in `text-[11px]`. Nimmt optional eine `className`-Prop entgegen (für
responsive Sichtbarkeit, siehe unten).

**Mobil sitzt der Schalter nicht im Header, sondern in der Sidebar** –
der Header (`dashboard-header.tsx`) blendet ihn unter `md` aus
(`className="hidden md:block"`), `app-sidebar.tsx` rendert ihn stattdessen
rechts neben dem Logo im `SidebarHeader`, nur wenn `useSidebar().isMobile`
true ist (die mobile mobile Sidebar ist ein Sheet-Overlay statt einer
Spalte, siehe `ui/sidebar.tsx`). Grund: der Header lief auf schmalen
Handys aus mehreren Icons + dem 82px breiten Schalter horizontal über.

## Token-Architektur (`globals.css`)

Zwei Ebenen:

1. **Rohe `--pivot-*`-Tokens** in `:root` (Light-Werte) und
   `[data-pivot-theme="dark"]` (überschreibt NUR die Roh-Tokens, nicht
   das Mapping darunter – `var()`-Referenzen lösen pro Element neu auf).
2. **Rollen-Mapping** auf die bestehenden shadcn-Variablen
   (`--background`, `--card`, `--muted`, `--border`, `--sidebar`, …) in
   `:root`, die auf die Pivot-Tokens zeigen. Jede Komponente, die bereits
   `bg-card`/`text-muted-foreground`/`border-border` nutzt, funktioniert
   dadurch automatisch korrekt im Dark Mode, ohne selbst angefasst zu
   werden.

Wichtige Roh-Tokens (Auszug, Light → Dark):

| Token | Light | Dark | Rolle |
|---|---|---|---|
| `--pivot-app-bg` | `#f4f4f5` | `#23272f` | Seitenhintergrund (`--background`) |
| `--pivot-shell` | `#ffffff` | `#0d1219` | Sidebar/Header-Fläche (`--sidebar`) |
| `--pivot-surface` | `#ffffff` | `#171c24` | Karten (`--card`) |
| `--pivot-ink` | `#1c2b3a` | `#d3dae4` | Haupttext (`--foreground`) |
| `--pivot-line` | `#e6e6e6` | `#2d3542` | Rahmen (`--border`) |
| `--pivot-switch-track-dark` | `#e6e6e6` | `#0f1420` | Dark/Light-Schalter-Track |

**Konstant in beiden Modi, nie im Rollen-Mapping überschrieben:**
`--pivot-lime` (`#bce64d`, → `--primary`) und `--pivot-on-lime`
(`#16181c`, → `--primary-foreground`) – die Markenfarbe ändert sich nicht
mit dem Theme.

**`--dark-surface`/`--dark-surface-foreground`** (= `--pivot-navy-solid`
+ weiß) sind ein separates Tokenpaar für Flächen, die **immer** dunkel
bleiben sollen, unabhängig vom aktuellen Theme (z.B. Avatar-Fallbacks,
der aktive Zustand von `segmented-picker.tsx`, Filter-Pills in
`media-filters.tsx`, das Bild-Anzahl-Badge in `media-explorer.tsx`) –
über `bg-dark-surface text-dark-surface-foreground`. **Wichtiger
Unterschied zu `--pivot-navy`**: `--pivot-navy` KIPPT mit dem Theme (wird
im Dark Mode hell, `#e9eef6`, für Fließtext, der auf dunklem Grund selbst
hell sein soll) – wer eine dauerhaft dunkle Fläche mit weißer Schrift
braucht (unabhängig vom Theme), muss `dark-surface` verwenden, nicht
`pivot-navy`. Eine Verwechslung hier führte einmal zu weißer Schrift auf
weißem Grund im Dark Mode (mehrere "immer-dunkle Pille"-Elemente waren
versehentlich auf das theme-kippende Token gemappt).

**Schatten → Rahmen im Dark Mode**: Schatten wirken auf dunklem Grund
unsichtbar/schmutzig, daher global:

```css
[data-pivot-theme="dark"] .shadow-sm,
[data-pivot-theme="dark"] .shadow,
[data-pivot-theme="dark"] .shadow-md,
[data-pivot-theme="dark"] .shadow-lg {
  box-shadow: none;
  border: 1px solid var(--pivot-line);
}
```

Betrifft die verbreitete "Card + `shadow-sm`"-Konvention app-weit, ohne
dass jede einzelne Komponente angepasst werden musste.

**Gestrichelte Ränder heller im Dark Mode**: `.border-dashed` bekommt im
Dark Mode `var(--pivot-g-dim)` statt der normalen `--pivot-line` – eine
gestrichelte Linie hat durch die Lücken weniger Farbfläche als eine
durchgezogene und wirkt bei gleichem Farbwert deutlich blasser, betrifft
app-weit jede gestrichelte Platzhalter-/Upload-Fläche.

**Logo-Umfärbung**: `.pivot-logo` bekommt im Dark Mode einen SVG-Duotone-
Filter (`filter: url(#pivot-logo-dark)`, Filter-Definition liegt einmalig
unsichtbar in `layout.tsx`) – mapped die ursprünglich dunklen Pixel
(Navy) auf LIME und die hellen (Lime) auf ON_LIME, damit sowohl das
Logo-Quadrat/der Schriftzug als auch das "p"/der Punkt im Dark Mode
korrekt umgefärbt werden, ohne ein zweites Bild-Asset zu brauchen.

## Kanonisches Badge-System

Alle Badge-/Chip-Farben sind als **eigene, unlayered CSS-Klassen**
(`.badge--*`, `.chip--*`) definiert – bewusst NICHT als Tailwind-
`@layer`-Utilities, damit die `inset box-shadow`-"Rahmen" (statt eines
echten `border`, der zusätzlichen Platz reservieren würde) zuverlässig
über Tailwind-Utility-Klassen greifen, unabhängig von Lade-/
Spezifitätsreihenfolge. Jede Klasse setzt ausschließlich `background`,
`color`, `box-shadow` – Radius/Padding/Schriftgröße/Flex kommen aus
`ui/badge.tsx`s `badgeVariants` (Basisklasse: `rounded-[5px]`, `h-5`,
`text-[11px]`).

**`Badge`-Komponente** (`ui/badge.tsx`) hat für die semantische Palette
eigene `variant`-Werte, die direkt auf die CSS-Klassen zeigen:

```ts
ink: "badge--ink border-0",
lime: "badge--lime border-0",
green: "badge--green border-0",
amber: "badge--amber border-0",
red: "badge--red border-0",
blue: "badge--blue border-0",
slate: "badge--slate border-0",
light: "badge--light border-0",
```

`border-0` ist notwendig, weil `badgeVariants`s Basisklasse
`border border-transparent` setzt – ohne das Überschreiben würde der
echte (transparente) Rand zusätzlich zum `inset box-shadow` Platz
reservieren. An Stellen ohne `<Badge>`-Komponente (z.B. rohe `<span>` in
`websites-view.tsx`) wird die Klasse direkt per Template-String
verwendet, `border-0` ist dort ohnehin irrelevant (keine `border`-Klasse
vorhanden, die kollidieren könnte).

**Sieben semantische Farbtöne**, je mit eigener Dark-Mode-Zeile in
`globals.css` (`ink`/`lime`/`green`/`amber`/`blue`/`slate`/`light`), plus
ein achter, nachträglich ergänzter Ton **`red`** (Nutzervorgabe: "bei
dringend und Sicherheit rot nehmen" – nicht Teil der ursprünglichen
Bildvorlagen-Palette, verwendet stattdessen exakt dieselben Hex-Werte wie
`system-message.tsx`s `error`-Variante, für App-weite Konsistenz zwischen
Badges und Alert-Boxen).

**Sieben feste Rollen-Farben** (`badge--admin`/`chefred`/`redakteur`/
`autor`/`medien`/`formular`/`gast`), zugeordnet über
`role-colors.ts`s `FIXED_ROLE_BADGE_COLORS` (Schlüssel = exakter
Rollenname: `Administrator`, `Chefredaktion`, `Redakteur`, `Autor`,
`Medienpflege`, `"Formular-Manager"`, `"Gast / Praktikum"`). Ein
selbst angelegter Rollenname ohne Eintrag hier fällt auf eine
deterministische Hash-Zuordnung aus einer generischen Tailwind-Palette
zurück (`ROLE_BADGE_COLORS`), damit auch unbekannte Rollen über die
Nutzer-Tabelle hinweg stabil dieselbe Farbe behalten – bewusst KEINE
eigene Dark-Mode-Zeile in `globals.css` nötig, da diese Palette bereits
`dark:`-Varianten je Tailwind-Klasse enthält.

**Drei `.chip--*`-Klassen** (`api`/`type`/`inactive`) für kleinere,
kontextspezifische Kennzeichnungen (z.B. API-Schlüssel-Typ), gleiches
Prinzip wie Badges, eigene, kleinere Basisklasse (`.chip`, `border-radius:
5px`, `padding: 2px 8px`, `font-size: 11px`).

**Weitere Verbraucher der kanonischen Klassen** (statt Ad-hoc-Tailwind-
Tönen):
- `website-status.ts`: `live` → `badge--green`, `development` →
  `badge--chefred` (bewusst lila, reuse der Chefredaktion-Rollenfarbe
  statt einer neuen generischen Lila-Klasse), `locked` → `badge--red`
  (ursprünglich `badge--ink`, geändert 2026-08-26/27 – siehe
  `master-slave-licensing.md`).
- `deployment-mode-badge.ts`: `slave`/"Client" → `badge--blue` (2026-08-27
  standardisiert, ersetzte ein Ad-hoc `bg-blue-100 text-blue-700` ohne
  eigene Dark-Mode-Variante). `master` behält bewusst einen exakten
  `lab()`-Farbwert (`bg-[lab(93_-4.76_94.87)] text-black`) statt einer
  kanonischen Klasse – noch nicht standardisiert, hat ebenfalls keine
  eigene Dark-Mode-Variante (bekannte Lücke, siehe "Offene Punkte"
  unten).
- `search.ts`: alle 9 `SEARCH_RESULT_TYPE_META`-Einträge nutzen
  kanonische Klassen (`badge--blue`/`green`/`amber`/`lime`/`ink`/
  `slate`), mehrfach wiederverwendet, da nur 7 Grundtöne für 9+
  semantische Bedeutungen zur Verfügung stehen.

**Regel für neue Badges**: keine neue Ad-hoc-Tailwind-Farbe erfinden –
immer eine der bestehenden `badge--*`-Klassen wiederverwenden (auch wenn
die semantische Bedeutung nicht perfekt passt), oder – nur bei echtem
Bedarf für eine neue, wirklich eigenständige Bedeutung – eine neue
`badge--*`-Klasse nach demselben Muster (Light + eigene Dark-Zeile,
`inset box-shadow` als Rahmen) ergänzen, wie beim `red`-Ton geschehen.

## `SystemMessage` – exakte Farben je Variante

`ui/system-message.tsx`s `VARIANT_STYLES` definiert für `info`/
`success`/`warning`/`error` je einen exakten Hex-Wert für Rahmen/
Hintergrund/Icon/Titel/Beschreibung in Light UND Dark Mode (arbiträre
Tailwind-Klassen wie `border-[#bfdbfe] dark:border-[#33507f]`, nicht die
generischen Tailwind-Farbstufen) – diese Farben gelten als **kanonisch
für jede Art von Alert/Hinweisbox** in der App, nicht nur für
`SystemMessage` selbst (z.B. der farbige Kopfbereich in
`website-check-details-dialog.tsx` dupliziert exakt dieselben Hex-Werte
lokal, da dort kein Fließtext, sondern ein individuell aufgebauter
Header gebraucht wird). Die `neutral`-Variante bleibt bewusst konstant
über beide Modi (`border-border bg-muted/60`, reine Token-Referenzen,
keine eigenen Hex-Werte).

Zwei optionale Props über die Grundfunktion hinaus: `titleClassName`
(einzelne Aufrufer brauchen einen kleineren Titel, z.B. die
Prüfergebnis-Kachel in `websites-view.tsx`) und `meta`/`metaClassName`
(rechtsbündiger Zusatztext in derselben Zeile wie der Titel, z.B. ein
Zeitstempel).

## Offene Punkte

- `DEPLOYMENT_MODE_BADGE.master` (Master-Badge) hat weiterhin keine
  eigene Dark-Mode-Variante und ist nicht auf die kanonische Palette
  umgestellt – nur "Client" wurde bisher standardisiert (Nutzervorgabe
  betraf ausdrücklich nur das Client-Badge).
- Diese Doku deckt den aktuellen Endzustand ab, nicht die vollständige
  Entstehungsgeschichte (mehrere iterative Korrekturrunden zu Icon-
  Farben, Kopfzeilen-Tönung, Hintergrundfarben usw. sind nicht mehr im
  Detail nachvollziehbar) – bei künftigen Änderungen an diesem System
  den aktuellen Code als Quelle nehmen, nicht diese oder ältere
  Zusammenfassungen.
