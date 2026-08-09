# Frontend: shadcn/ui auf Base-UI-Basis (`render` statt `asChild`)

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web

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
`pathname === url || pathname.startsWith(\`${url}/\`)` und wählt bei
mehreren Treffern die **längste** passende URL (sonst würde z.B.
`/dashboard` als Präfix jeder anderen Route immer zuerst matchen). Ein
gemeinsamer `activeItemUrl`-Wert treibt sowohl die Menüpunkt-
Hervorhebung (`isActive`) als auch die fette Gruppen-Beschriftung
(`isEmphasized`) – gilt automatisch für alle künftigen Detailseiten
unter einem Listen-Item, ohne dass pro Route etwas ergänzt werden muss.
Beim Verifizieren per `curl`+`grep` Vorsicht: Base-UI rendert `data-active`
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
