# Frontend: shadcn/ui auf Base-UI-Basis (`render` statt `asChild`)

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web

> **Update 2026-08-16 (Vorschau-Links unter Seiten einsortiert):**
> "verschiebe vorschau-links unter seiten" – `app-sidebar.tsx`s
> `navGroups`: "Vorschau-Links" war ein eigenständiges Item auf oberster
> Ebene innerhalb der "Inhalte"-Gruppe, jetzt `children`-Eintrag von
> "Seiten" (neben FAQs/Galerien, gleiches Muster wie "Tags" unter
> "Medien"). Reine Config-Änderung – Breadcrumbs/aktiver Sidebar-Status
> lesen `navGroups` bereits generisch inkl. `children`, keine weitere
> Anpassung nötig.

## Was wurde gebaut

Next.js-Dashboard mit shadcn/ui-Komponenten: `Sidebar`, `Card`, `Table`,
`Form` (react-hook-form + zod), `Button`, `Dialog`, `Sheet`, `Badge`, u.a.
Dashboard-Layout (`app/dashboard/layout.tsx`) mit `AppSidebar`
(`components/app-sidebar.tsx`), Login-Seite mit validiertem Formular
(`app/login/page.tsx`).

## Warum diese Lösung

shadcn/ui wurde gewählt, weil der Komponenten-Code direkt ins Projekt
generiert wird (volle Kontrolle, keine Blackbox-Library) und weil es sich
gut mit Tailwind v4 und Next.js App Router kombiniert.

## Stolpersteine / Besonderheiten

**Wichtig für alle, die mit "klassischem" shadcn/Radix-Wissen arbeiten:**
Die zum Zeitpunkt der Projektanlage aktuelle shadcn-Registry generiert
Komponenten auf Basis von **`@base-ui/react`** statt Radix UI. Das ändert
das Polymorphie-Pattern:

```tsx
// Base UI (so funktioniert es in diesem Projekt):
<Button render={<Link href="/dashboard/content/new" />}>
  Neuer Inhalt
</Button>

<SidebarMenuButton render={<Link href={item.url} />} isActive={...}>
  <item.icon />
  <span>{item.title}</span>
</SidebarMenuButton>

// Radix-Pattern (klassisches shadcn-Wissen, funktioniert HIER NICHT):
<Button asChild>
  <Link href="/dashboard/content/new">Neuer Inhalt</Link>
</Button>
```

`asChild` existiert auf `Button`/`SidebarMenuButton` in dieser Version
schlicht nicht als Prop (TS2322-Fehler beim Kompilieren). Betroffene
Komponenten erkennt man daran, dass sie intern `@base-ui/react/*` statt
`radix-ui`/`@radix-ui/*` importieren (Interna: `useRender`-Hook aus
`@base-ui/react/use-render`).

Zweiter Stolperstein: Die von `shadcn add form` heruntergeladene
`form.tsx`-Registry-Datei enthielt einen fehlerhaften Importpfad
(`@/registry/new-york-v4/ui/label` statt `@/components/ui/label`) – die
`form`-Komponente ließ sich zudem über `shadcn@latest add form` nicht
zuverlässig automatisch installieren (Befehl lief durch, ohne Dateien
anzulegen). Workaround: Registry-JSON direkt von
`https://ui.shadcn.com/r/styles/new-york-v4/form.json` geladen, `files[0].content`
extrahiert und den Importpfad manuell korrigiert. Bei künftigen
`shadcn add`-Aufrufen für neue Komponenten immer kurz `tsc --noEmit`
laufen lassen, um solche Registry-Bugs früh zu erkennen.

**Dritter Stolperstein (2026-08-03):** Base UI's `Button`-Primitive hat ein
`nativeButton`-Prop mit Default `true` – es geht also standardmäßig davon
aus, dass das gerenderte Element ein echtes `<button>` ist, und warnt in
der Konsole ("expected a native `<button>`..."), sobald `render` auf ein
Nicht-Button-Element wie `<Link>` (rendert `<a>`) zeigt. Fix zentral im
Wrapper `components/ui/button.tsx`: `nativeButton={nativeButton ??
!props.render}` – ist `render` gesetzt, wird `nativeButton`
automatisch `false`, sofern nicht explizit anders angegeben. Damit müssen
einzelne `<Button render={<Link .../>}>`-Stellen das nicht mehr manuell
setzen.

**Vierter Stolperstein (2026-08-08):** Der aktive Menüpunkt in
`app-sidebar.tsx` wurde ursprünglich per exaktem `pathname === item.url`
bestimmt – funktioniert für Listen-Seiten, aber nicht für deren
Detailseiten (`/dashboard/content/new`, `/dashboard/content/[id]/edit`
etc.), die dadurch keinen aktiven Menüpunkt/keine fette Gruppen-
Beschriftung zeigten. Fix: `findBestMatchingUrl(pathname, urls)` prüft
`pathname === url || pathname.startsWith(\`${url}/\`)`und wählt bei
mehreren Treffern die **längste** passende URL (sonst würde z.B.`/dashboard`als Präfix jeder anderen Route immer zuerst matchen). Ein
gemeinsamer`activeItemUrl`-Wert treibt sowohl die Menüpunkt-
Hervorhebung (`isActive`) als auch die fette Gruppen-Beschriftung
(`isEmphasized`) – gilt automatisch für alle künftigen Detailseiten
unter einem Listen-Item, ohne dass pro Route etwas ergänzt werden muss.
Beim Verifizieren per `curl`+`grep`Vorsicht: Base-UI rendert`data-active`
als leeres, aber vorhandenes Attribut (`data-active=""`), dessen Position
im Tag relativ zu anderen Attributen variiert – ein fixes
Zeichen-Lookbehind-Fenster im Grep-Pattern kann dadurch fälschlich
"nicht gefunden" liefern; zuverlässig ist nur, den kompletten `<a ...>`-
Tag zu extrahieren und darin zu suchen.

**Breadcrumbs (2026-08-08):** `components/ui/breadcrumb.tsx` (shadcn-
Primitive) lag seit Projektanlage ungenutzt im Repo. Neue Komponente
`dashboard-breadcrumbs.tsx` baut den Pfad **wieder aus derselben
`navGroups`-Struktur** wie der Sidebar-Aktiv-Status (dafür wurde
`navGroups` in `app-sidebar.tsx` exportiert – eine einzige Quelle statt
zweier Kopien, die auseinanderlaufen könnten): längste passende
Item-URL gewinnt, IDs im Pfad (`/^[a-z0-9]{20,}$/i`, cuid/cuid2) werden
herausgefiltert, bekannte Aktions-Segmente (`new`/`edit`/`versions`)
bekommen deutsche Labels über eine kleine `ACTION_LABELS`-Map,
Gruppen-Crumb entfällt bei Gruppen mit nur einem Item (aktuell nur
"Übersicht" → "Dashboard", sonst stünde dort zweimal derselbe Name).
Zwei Routen liegen außerhalb der Sidebar-Struktur (`/dashboard/account`,
nur über das Nutzer-Menü erreichbar; `/dashboard/settings`, im
Sidebar-Footer statt einer regulären Gruppe) – eigene
`STANDALONE_ROUTES`-Map als Fallback.

Eingebunden in `dashboard-header.tsx` (SidebarTrigger → Separator →
Breadcrumbs → GlobalSearch → Nutzer-Menü). Wegen der Projekt-Regel "kein
horizontales Scrollen, nirgends" (mehrfach vom Nutzer bekräftigt, u.a. am
Beispiel der Tabellen-Spalten): Breadcrumb-Container hat `min-w-0
shrink` und einzelne Labels `truncate` statt zu umbrechen, komplett
`hidden` unterhalb `sm` (Header ist ohnehin mit SidebarTrigger + Suche +
Avatar auf Mobile schon eng).

## Relevante Dateien

- `apps/web/src/components/ui/*` (generierter shadcn-Code)
- `apps/web/src/components/app-sidebar.tsx`
- `apps/web/src/components/dashboard-breadcrumbs.tsx`
- `apps/web/src/components/dashboard-header.tsx`
- `apps/web/src/app/dashboard/content/page.tsx`
- `apps/web/components.json` (shadcn-Konfiguration)

## Offene Punkte

- Noch keine API-Anbindung (Platzhalterdaten in `content/page.tsx` und
  Dashboard-Statistiken).
- Kein Dark-Mode-Umschalter, obwohl Tailwind-Theming dafür vorbereitet ist.

## Update 2026-08-31: eingeklappte Sidebar ohne Scrollbalken, größere Icons

Nutzervorgabe: "sidebar eingeklappt kein Scrollbalken und Icons etwas
größer".

- Der Balken wird im eingeklappten Zustand komplett ausgeblendet. Erster
  Versuch war eine Tailwind-Variante an `SidebarContent`
  (`group-data-[collapsible=icon]:[scrollbar-width:none]`) – der Balken
  blieb sichtbar. Endstand ist deshalb eine schlichte Regel bei den
  übrigen Scrollbalken-Regeln in `globals.css`:

  ```css
  [data-collapsible="icon"] * {
    scrollbar-width: none;
  }
  [data-collapsible="icon"] *::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
  ```

  Sie hängt am Zustands-Attribut der Sidebar und greift damit für **jedes**
  scrollende Element darin, egal welche Komponente es rendert. Bewusst nur
  die **Anzeige** – `overflow-y-auto` bleibt, sonst wären bei vielen
  Modulen die unteren Einträge auf kleinen Bildschirmen nicht mehr
  erreichbar.

- **Nebeneffekt, der einen zweiten Nutzerpunkt löst** ("Icons sind nicht
  mittig"): der sonst dauerhaft reservierte 3px-Streifen des schmalen
  Balkens (siehe Kommentar bei `.themed-scrollbar`) entfällt im
  eingeklappten Zustand, wodurch die Icon-Buttons wieder exakt mittig in
  der 5,5rem-Spalte sitzen.
- `navIconChipClass` (`app-sidebar.tsx`): eingeklappt `[&_svg]:size-5`
  statt `size-4` – dort sind die Icons das einzige Erkennungsmerkmal.
  Ausgeklappt bleibt es bei `size-4`, damit Icon und Label ausgerichtet
  bleiben.

Beide Regeln landen nachweislich im kompilierten Stylesheet (geprüft).

### Nachtrag: der Balken blieb trotzdem stehen

Zwei Anläufe reichten nicht (Tailwind-Variante an `SidebarContent`, dann
eine Regel auf `[data-collapsible="icon"]`). Endstand ist deshalb
zusätzlich eine ganz gewöhnliche Klasse, die vom React-Zustand gesetzt
wird – damit hängt nichts mehr daran, ob ein Attribut-Selektor zum
richtigen Element passt:

```tsx
<SidebarContent className={sidebarState === "collapsed" ? "no-scrollbar" : undefined}>
```

`.no-scrollbar` in `globals.css` setzt `scrollbar-width: none` und
`::-webkit-scrollbar { display: none }`, beides mit `!important`, weil
`.themed-scrollbar` dieselben Eigenschaften belegt. Die Attribut-Regel
bleibt als Netz für andere scrollende Elemente in der eingeklappten
Spalte bestehen.

**Merke:** Dev-CSS wird aggressiv gecacht – nach solchen Änderungen ein
hartes Neuladen (Strg+F5), sonst sieht man weiter den alten Stand.

## Update 2026-08-31: fehlende Breadcrumbs nachgezogen

Auf `/dashboard/categories` fehlte die Breadcrumb-Zeile unter der
Überschrift (Nutzermeldung). Nachgeholt in `category-explorer.tsx` nach
dem üblichen Muster (`<h1>` plus `<DashboardBreadcrumbs />` im selben
`<div>`, Kopfzeile auf `sm:items-start` statt `sm:items-center`, sonst
sitzen Titel und Aktions-Buttons nach dem Hinzufügen der zweiten Zeile
nicht mehr auf einer Höhe).

Bei der Gelegenheit alle Seitenköpfe durchgesehen: es fehlte zusätzlich
auf `/dashboard/system-messages` (`notifications-view.tsx`), ebenfalls
ergänzt. Die drei weiteren Treffer (`company`, `privacy`, `settings`)
sind reine "keine Berechtigung"-Zustände in der jeweiligen `page.tsx` –
die echten Ansichten dieser Seiten haben ihre Breadcrumbs.
