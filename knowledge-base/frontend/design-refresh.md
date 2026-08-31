# Design-Refresh nach Referenz-Screenshots (Koralle/Orange-Theme)

**Datum:** 2026-08-05
**Betroffene Bereiche:** apps/web (`src/app/globals.css`,
`src/components/{app-sidebar,dashboard-header,ui/card,ui/checkbox}.tsx`,
alle Row-Action-Komponenten der Listen-Ansichten)

> **Update 2026-08-15 (Sidebar-Unterpunkte: Abstand zum aktiven
> Eltern-Hintergrund):** "die ersten punkte unter seiten und medien ...
> müssen etwas mehr abstand zum aktive bg haben, so dass beim hovern
> nicht beide bgs zusammenkleben" – `SidebarMenuSub` in
> `app-sidebar.tsx` überschrieb die Basis-Klasse (`ui/sidebar.tsx`,
> die dort standardmäßig `py-0.5` mitbringt) explizit mit `py-0`, wodurch
> das erste Unterpunkt-Element direkt am aktiven/gehoverten Eltern-
> Hintergrund klebte (kein sichtbarer Zwischenraum). Fix: `py-0` → `py-1`
> in der `SidebarMenuSub`-Instanz (Zeile mit `mx-0 border-l-0 px-0
py-1`) – per CDP-Screenshot mit simuliertem Hover auf den ersten
> Unterpunkt verifiziert (z.B. "Medien" aktiv + Hover auf "Tags"
> darunter zeigt jetzt einen klaren Zwischenraum zwischen beiden
> Hintergründen).

> **Update 2026-08-16 (Marketing-Badge oben links auf allen drei
> Auth-Seiten):** "und füge das auf der login, registrieren und
> passwort vergessen seite ein" – kleines Badge oben links im Bild
> (`bg-black/40 backdrop-blur-sm`, lime Punkt, "Websoftware für alle
> Bereiche"), 1:1 nach Bildvorlage. Nur einmal in `auth-shell.tsx`
> ergänzt, nicht auf den drei Seiten einzeln – Login/Registrieren/
> Passwort-vergessen (und Passwort-zurücksetzen) teilen sich diese eine
> Shell-Komponente bereits, siehe direkt darunter.

> **Update 2026-08-15 (Feste Logos statt konfigurierbar, Auth-Shell
> responsive + Marketing-Overlay, globaler `destructive`-Button-Stil,
> Breadcrumb-Farben):**
>
> - **Logos wieder fest hinterlegt**: Sidebar-Logo (aus-/eingeklappt) und
>   das Bild rechts auf Anmelden/Registrieren sind auf Nutzerwunsch nicht
>   mehr über die Einstellungen änderbar (Rückbau des in diesem Dokument
>   weiter unten beschriebenen "Logo & Firmenangaben"-Features für diese
>   zwei konkreten Slots). `companyLogoUrl` bleibt als einzelnes, aktuell
>   an keiner Stelle im Dashboard verwendetes "Firmenlogo"-Upload-Feld in
>   den Einstellungen bestehen (Details siehe
>   [settings-and-password-policy.md](../auth/settings-and-password-policy.md)).
> - **`auth-shell.tsx` (Login/Register/Passwort-vergessen)**: füllt jetzt
>   die Viewport-Höhe (außer der Inhalt braucht mehr Platz), ist mobil
>   responsiv, und das Bild rechts hat ein Marketing-Overlay (Headline,
>   Tagline, vier Badge-Tags). "Passwort vergessen" nutzt denselben
>   Shell-Screen wie Login. **Stolperstein**: Das `<img>` als normales
>   Flex-Kind mit `size-full` ließ seine eigene Seitenverhältnis-
>   Berechnung (hypothetical size aspect-ratio fallback) die Höhe der
>   Flex-Zeile mit unbestimmter Höhe aufblähen und erzeugte ungewollten
>   Seiten-Scroll auf kurzen Viewports – Fix: `<img>` auf `absolute
inset-0 size-full object-cover` umgestellt statt normaler
>   Flow-Kind-Positionierung.
> - **`ui/button.tsx`s `variant="destructive"` global umgestellt**: von
>   gefüllter Fläche (`bg-destructive/10`) auf Outline-Stil (`bg-
transparent`, `border-destructive/30`, `text-destructive`,
>   `hover:bg-destructive/10`) – 1:1 nach Referenzbild (weißer
>   "Löschen"-Button mit hellrotem Rahmen neben grünem "Erstellen" und
>   weißem "Bearbeiten"). Wirkt automatisch auf **jede**
>   `variant="destructive"`-Verwendung, inklusive `AlertDialogAction` in
>   `ConfirmDeleteDialog` (wrapped `Button` direkt) – bewusst keine
>   zweite Variante eingeführt, sondern der bereits mehrfach ad-hoc
>   nachgebaute Stil (z.B. in `faq-groups-manager.tsx`, dort jetzt
>   entfernt zugunsten der echten Variante) als Standard übernommen.
> - **`ui/breadcrumb.tsx`**: `BreadcrumbLink` (klickbar) in dunklerem
>   Grün (`text-lime-700`/`hover:text-lime-800`, dark: `lime-500`/
>   `lime-400`), `BreadcrumbPage` (aktuelle, nicht-klickbare Seite) in
>   hellerem Grün (`text-lime-400`, dark: `lime-600`) statt der
>   bisherigen neutralen `text-foreground`-Farbe.
>
> **Update 2026-08-06 (Globaler Standard-Button-Stil: Verlauf statt
> Flächenfarbe; Outline-Buttons ohne Hintergrund):** Zwei Änderungen an
> `ui/button.tsx` (`buttonVariants`), wirken dadurch **automatisch auf
> jede** `<Button>`-Verwendung im gesamten Projekt (kein Component nutzt
> mehr eine lokale Farbe für Primär-/Sekundär-Buttons):
>
> - **`variant="outline"`** (Sekundär-Aktionen wie "Zurücksetzen",
>   "Abbrechen"): `bg-background` entfernt → `bg-transparent`. Vorher
>   sah der Button durch die helle Flächenfarbe wie eine gefüllte Pille
>   aus, jetzt nur Rahmen + Text, kein Hintergrund.
> - **`variant="default"`** (Primär-Aktionen, z.B. "Übernehmen",
>   "Speichern", "Anmelden", "Neuer Eintrag" – der mit Abstand meist-
>   verwendete Button-Typ im Projekt): von einer flachen `bg-primary`-
>   Fläche auf den Koralle→Rosé-Verlauf umgestellt
>   (`bg-gradient-to-r from-orange-400 to-rose-500`, `hover:opacity-90`
>   statt einer zweiten Flächenfarbe für den Hover-Zustand). Dieser
>   Verlauf wurde vorher schon punktuell per Inline-`className` an
>   einzelnen Stellen (z.B. der "Übernehmen"-Button im neuen
>   `DateTimePicker`) nachgebaut – dieser lokale Override ist jetzt
>   überflüssig und wurde entfernt, da die Basis-Komponente ihn
>   automatisch mitbringt.
> - Bewusst **nicht** angefasst: `variant="destructive"` (bleibt rot,
>   damit Löschen-Aktionen visuell nicht mit der einladenden
>   Primärfarbe verwechselt werden) sowie `bg-primary`-Verwendungen
>   außerhalb von `Button` (Checkbox/Switch-Akzentfarbe, Avatar-
>   Fallback, Badge-Default) – die Anfrage bezog sich explizit auf
>   Buttons, eine Umfärbung dieser anderen Komponenten war nicht
>   verlangt und hätte den Scope unnötig ausgeweitet.
> - Verifiziert per Live-Check über acht verschiedene Dashboard-Seiten
>   plus die öffentliche Login-Seite – überall erscheint der neue
>   Verlauf-Stil ohne weitere Anpassungen nötig zu haben.

> **Update 2026-08-06 (Eingeklapptes Logo: größer, zentriert,
> Initialen-Fallback; Mobile Burger-Icon; Logo-Upload-Breite):**
>
> - Eingeklapptes Sidebar-Logo `size-8` → `size-12`; zusätzlich
>   `group-data-[collapsible=icon]:gap-0` (statt `gap-2`) auf dem
>   Header-Container – der ungenutzte Flex-`gap` zum (jetzt `w-0`)
>   Wortmarken-Span schob das Icon sonst leicht aus der Mitte.
> - **Fallback ohne Logo**: statt eines statischen "S" zeigt die
>   eingeklappte Kachel jetzt die ersten zwei Buchstaben von
>   `AppSettings.companyName` (uppercased), oder `"TW"`, falls
>   `companyName` leer ist (`fallbackInitials()` in
>   `app-sidebar.tsx`, `companyName` neu von `dashboard/layout.tsx`
>   durchgereicht). Per Live-Test mit temporär umgeschaltetem
>   `logoCollapsedUrl`/`companyName` verifiziert (danach beide Werte
>   wieder auf den ursprünglichen Dev-Stand zurückgesetzt).
> - **Mobile Sidebar-Trigger**: zeigt jetzt ein Burger-Menü-Icon
>   (`MenuIcon`) statt des Desktop-`PanelLeftIcon`, wenn
>   `useSidebar().isMobile` true ist (`ui/sidebar.tsx`).
> - **`LogoUploadField`**: das `type="file"`-Input hatte `flex-1` und
>   spannte sich dadurch über die volle Kartenbreite auf
>   (`Datei auswählen ... Keine ausgewählt` mit riesigem Leerraum
>   dazwischen). `flex-1` entfernt, `max-w-xs` gesetzt.

> **Update 2026-08-06 (Größeres Logo, Navigation wieder gruppiert,
> Mobile-Navigation-Fix):**
>
> - **Ausgeklapptes Logo vergrößert**: `h-6` → `h-11` (24px → 44px) in
>   `app-sidebar.tsx`, Header-Zeile `py-1.5` → `py-2` für mehr Luft.
> - **Navigation wieder in Gruppen** ("Übersicht", "Inhalte",
>   "Verwaltung" mit `SidebarGroupLabel`) – bewusste **Rücknahme** der
>   Entscheidung vom 2026-08-05 oben ("Content"/"Verwaltung" entfernt, da
>   in der damaligen Referenz eine durchgehende flache Liste war). Auf
>   erneuten Nutzerwunsch ("gliedere die navigation sinnvoll") jetzt
>   wieder gruppiert, mit anderer Aufteilung als zuvor:
>   `navItems`-Flat-Array → `navGroups` (Array aus `{label, items[]}`),
>   je Gruppe eigene `SidebarGroup`/`SidebarGroupLabel`/`SidebarMenu`;
>   leere Gruppen (alle Items durch fehlende Permission gefiltert) werden
>   nicht gerendert.
> - **Mobile-Navigation-Bug behoben** (Sidebar-Trigger reagierte auf
>   schmalen Viewports nicht): `hooks/use-mobile.ts`s `useIsMobile()`
>   initialisierte seinen State per `useState(getIsMobile)` mit einem
>   Lazy-Initializer, der `window.innerWidth` **sofort beim ersten
>   Render** auswertet. Serverseitig ist `window` undefined → immer
>   `false` (Desktop-Zweig), client­seitig beim ersten Hydrations-Render
>   dagegen sofort der echte Wert. `Sidebar` in `ui/sidebar.tsx` verzweigt
>   direkt auf diesem Wert (`if (isMobile) return <Sheet>…</Sheet>` vs.
>   der Desktop-`<div>`-Struktur) – auf echten Mobilgeräten entstand dadurch
>   ein struktureller Hydration-Mismatch (Server rendert `<div>`, Client
>   will `<Sheet>`/Dialog rendern), wodurch React den Trigger-Button neu
>   aufbauen musste und dessen Klick-Handler dabei verloren gehen konnte.
>   Fix: State startet bewusst mit `undefined` (SSR und erster Client-
>   Render liefern beide `false` via `!!undefined`), der echte Wert wird
>   erst **danach** in einem `useEffect` gesetzt – ein normales State-
>   Update nach dem Mount statt eines Strukturunterschieds beim Hydrieren.
>   Exakt das Muster, das shadcn/ui im offiziellen `use-mobile.ts`
>   verwendet; unser Hook war davon abgewichen.

> **Update 2026-08-05 (Korrekturen nach Vergleichsscreenshots):** Zwei
> Nachbesserungen, nachdem der Nutzer Vorher/Nachher-Screenshots
> gegenübergestellt hat: (1) die aktive Sidebar-Pille war als
> eingerückte Kapsel mit sichtbarem Rand links/rechts gerendert statt
> randlos über die volle Breite zu laufen wie in der Referenz – Fix über
> `-mx-2 w-[calc(100%+1rem)]` (negatives Margin hebt das `p-2` von
> `SidebarGroup` exakt auf, siehe Stolpersteine), plus `rounded-lg` statt
> `rounded-xl` (weniger kapselartig). Die Gruppenüberschriften "Content"/
> "Verwaltung" gab es in der Referenz nicht (durchgehende flache Liste) –
> entfernt, `navMain`/`navManage` zu einem `navItems`-Array
> zusammengeführt. (2) Status-Badges (Content-Status, Benutzer-Aktiv-
> Status) nutzten bisher nur `default`/`secondary`/`outline` (Graustufen)
> statt pro Wert unterschiedlicher Farben wie in der Referenz-Tabelle
> (Ordered/Confirmed/Shipped/Delivered) – jetzt feste Farbzuordnung
> (Grün=Veröffentlicht/Aktiv, Grau=Entwurf/Deaktiviert, Amber=Geplant,
> Blau=Archiviert) über `className` auf `variant="secondary"` (Farbe
> überschreibt via `tailwind-merge` sauber `bg-secondary`/
> `text-secondary-foreground`, `border-transparent` bleibt erhalten –
> `variant="outline"` wäre hier falsch gewesen, da dessen sichtbarer
> `border-border`-Ring nicht überschrieben würde und einen ungewollten
> grauen Rahmen um die farbige Pille hinterlässt).

> **Update 2026-08-05 (Sidebar/Content gleiche Hintergrundfarbe,
> Hover-Kontrast):** Nutzer-Feedback anhand eines direkten
> Vorher/Nachher-Vergleichs: `--sidebar` war fälschlich weiß
> (`oklch(1 0 0)`), während `--background` bereits das gewünschte helle
> Grau war – dadurch gab es eine sichtbare Kante zwischen Sidebar und
> Content, die es in der Referenz nicht gibt. Fix: `--sidebar`/
> `--sidebar-border` exakt auf denselben Wert wie `--background` gesetzt
> (Light **und** Dark Mode) – Sidebar und Content-Fläche verschmelzen
> jetzt nahtlos, nur echte Karten (`--card`, weiß) heben sich davon ab.
> Als Nebeneffekt war der Hover-/Aktiv-Kontrast auf der Sidebar dadurch
> zu schwach (`--sidebar-accent` lag mit `oklch(0.95 …)` sehr nah an
> `--sidebar` mit `oklch(0.97 …)`) – das erklärt vermutlich auch den
> gemeldeten Eindruck "Hover-Effekt nicht abgerundet" (die Rundung war
> in den gerenderten CSS-Klassen nachweislich korrekt, siehe unten, aber
> bei kaum wahrnehmbarem Farbkontrast ist eine runde Fläche optisch
> praktisch nicht von einer eckigen zu unterscheiden). `--sidebar-accent`
> testweise dunkler/kräftiger gesetzt (`oklch(0.91 0.035 45)`) für klar
> sichtbaren Hover.
>
> Dabei außerdem ein selbst eingebauter Fehler gefunden und behoben: ein
> versuchsweise ergänztes `!rounded-lg` (Tailwind-v3-Syntax, führendes
> `!`) wurde von `tailwind-merge` **nicht** als Konflikt mit der
> Basis-Klasse `rounded-md` erkannt, wodurch beide Klassen gleichzeitig
> im Markup landeten – dieses Projekt nutzt Tailwind v4, das die
> Important-Markierung **nachgestellt** schreibt (`rounded-lg!`, siehe
> die bereits vorhandenen `group-data-[collapsible=icon]:size-8!` in
> `ui/sidebar.tsx`). Die einfache, unmarkierte `rounded-lg`-Klasse (ohne
> `!`) wurde dagegen von `tailwind-merge` nachweislich korrekt gegen
> `rounded-md` gemerged (per `curl` gegen die gerenderte Seite
> verifiziert, kein `rounded-md` mehr im finalen `class`-Attribut) –
> die Änderung wurde daher wieder zurückgenommen.

> **Update 2026-08-05 (Nav-Spacing, eckiger Hover, Trigger-Überlappung):**
> Drei weitere Korrekturen: (1) mehr horizontaler Innenabstand für
> Icon+Text (`px-4 py-2` statt `p-2`), der Hover-/Aktiv-Hintergrund
> bleibt trotzdem randlos über die volle Breite (`-mx-2
w-[calc(100%+1rem)]` unverändert) – nur der Inhalt rückt weiter nach
> innen, nicht die farbige Fläche. (2) `rounded-lg` auf dem Hover-/
> Aktiv-Hintergrund durch `rounded-none` ersetzt – eckige, randlose
> Balken statt abgerundeter Pillen (Kurskorrektur zur vorherigen
> abgerundeten Variante). (3) `SidebarTrigger` (Ein-/Ausklappen) aus dem
> `SidebarHeader` in den `DashboardHeader` (Topbar, vor dem Suchfeld)
> verschoben: im eingeklappten Icon-only-Zustand ist die Sidebar nur
> `3rem` breit (`SIDEBAR_WIDTH_ICON`) – Logo (`w-8`) plus Trigger
> nebeneinander mit `justify-between` passten dort nicht mehr
> hinein, wodurch der Trigger sichtbar über den Sidebar-Rand hinaus in
> die Topbar/Suchleiste hineinragte. Der Header hat unabhängig vom
> Sidebar-Zustand immer genug Platz, daher liegt der Trigger dort jetzt
> dauerhaft richtig – ein in Dashboard-Templates verbreitetes Muster
> (Collapse-Toggle in der Topbar statt in der Sidebar selbst), das genau
> dieses Platzproblem grundsätzlich vermeidet.

> **Update 2026-08-05 (Buttons global `rounded-full`, außer Sidebar):**
> Auf explizite Vorgabe (Referenzbild: "Reset"/"Apply"-Pillenbuttons):
> `ui/button.tsx`s `buttonVariants`-Basis von `rounded-lg` auf
> `rounded-full` umgestellt – wirkt projektweit auf **jeden** `Button`
> (alle Dialoge, Formulare, Aktionsleisten), da es die einzige geteilte
> Button-Komponente ist. Gegenstück: `ui/sidebar.tsx`s
> `sidebarMenuButtonVariants`-Basis von `rounded-md` auf `rounded-none`
> umgestellt, damit **alle** Sidebar-Menüpunkte (nicht nur die in
> `app-sidebar.tsx` einzeln behandelten) automatisch eckig bleiben, statt
> es an jeder Aufrufstelle einzeln überschreiben zu müssen.
>
> **Stolperstein dabei gefunden**: Die Button-`size`-Varianten `xs`,
> `sm`, `icon-xs`, `icon-sm` hatten jeweils einen eigenen, fest
> codierten `rounded-[min(var(--radius-md),Npx)]`-Wert direkt in der
> Variante hinterlegt (ursprünglich gedacht für eine kleinere Rundung
> bei kompakten Buttons) – der kam in der von `cva` zusammengesetzten
> Klassen-Kette **nach** der Basis-Klasse und gewann daher bei
> `tailwind-merge` gegen das neue `rounded-full`. Betroffen waren u.a.
> der in den `DashboardHeader` verschobene `SidebarTrigger`
> (`size="icon-sm"`) sowie potenziell alle Kebab-Menü-Trigger mit
> `size="icon-sm"`, die keine eigene `rounded-full`-Klasse explizit
> gesetzt hatten. Fix: die hartcodierten `rounded-[...]`-Werte aus
> diesen vier Größen entfernt, sie erben jetzt korrekt `rounded-full`
> von der Basis. Das unabhängige `in-data-[slot=button-group]:rounded-lg`
> (für eine im Projekt aktuell ungenutzte `ButtonGroup`-Komposition)
> blieb unangetastet.
>
> Nebenbei behoben: "Neuer Ordner" (`folder-dialog.tsx`,
> `variant="outline" size="sm"`) und "Datei hochladen"
> (`media-upload-dialog.tsx`, Default-Größe) hatten unterschiedliche
> Höhen (`h-7` vs. `h-8`) – `size="sm"` beim "Neuer Ordner"-Button
> entfernt, beide nutzen jetzt dieselbe Standardgröße.

> **Update 2026-08-05 (Einheitlicher Schatten für alle Kacheln/Listen,
> Tab-Fix):** Exakter Schatten-Wert aus Design-Vorgabe (X:0, Y:20,
> Blur:40, Spread:0, `#000000` 16%) als wiederverwendbares Theme-Token
> `--shadow-card` (`@theme inline` in `globals.css`) ergänzt, nutzbar
> als Tailwind-Utility `shadow-card`. `ui/card.tsx` (Dashboard-Kacheln)
> nutzt es jetzt statt des bisherigen `shadow-sm` + `ring-1`. Auf
> Wunsch ("wie im Dashboard die Kacheln") auf **alle** Listen-/
> Kachel-Container übertragen, die bisher nur einen schlichten
> `rounded-lg border` hatten: die vier Tabellen-Wrapper (Inhalte,
> Rollen, Benutzer, Kategorien/Tags), Medien-Kacheln
> (`media-grid.tsx`) und Ordner-Kacheln (`media-folder-browser.tsx`) –
> jeweils `rounded-2xl bg-card shadow-card` statt `rounded-lg border`.
>
> Dabei zusätzlich einen durch die Grau-Umstellung von
> Sidebar/Content (siehe oben) entstandenen Folgefehler gefunden: Der
> aktive Tab in `ui/tabs.tsx` nutzte `data-active:bg-background` – als
> `--background` noch reines Weiß war, sah das wie ein weißer
> "Button" auf grauem `TabsList`-Hintergrund aus, seit `--background`
> aber dieselbe graue Farbe wie die Sidebar hat, war der aktive Tab
> kaum noch vom `TabsList`-Hintergrund (`bg-muted`) zu unterscheiden.
> Fix: `data-active:bg-background` → `data-active:bg-card` (bleibt
> das dedizierte "weiße Oberfläche"-Token, unabhängig von der jetzt
> grauen `--background`).

> **Update 2026-08-05 (mehr Innenabstand in Kacheln):** Auf Wunsch mehr
> Padding in allen Kachel-Elementen: `Card`s `--card-spacing` von
> `--spacing(4)`/`--spacing(3)` (16px/12px) auf `--spacing(6)`/
> `--spacing(4)` (24px/16px) erhöht (wirkt auf alle Dashboard-Kacheln).
> Medien-Kachel-Beschriftung (`figcaption`) von `px-2 pb-2` auf `px-4
pb-4`, Ordner-Kacheln von `p-2` auf `p-4`. Bewusst nur auf
> Kachel-/Karten-Elemente angewendet, nicht auf die Tabellen-Zellen der
> Listen-Ansichten (Inhalte/Benutzer/Rollen/Kategorien/Tags) – die
> haben ihr eigenes, unverändertes Zell-Padding über `TableCell`/
> `TableHead`, "Kachel" und "Liste" sind im Projekt-Sprachgebrauch
> bewusst getrennte Konzepte (siehe vorheriger Nutzer-Hinweis "die
> Liste soll so sein" vs. "wie im Dashboard die Kacheln").

> **Update 2026-08-05 (Tabellen-Zell-Padding an Kacheln angeglichen):**
> Doch auf ausdrücklichen Wunsch auch für Tabellen: `TableHead`/
> `TableCell` von `h-10 px-2`/`p-2` auf `px-6 py-4` erhöht (Wert
> orientiert sich an der horizontalen Kachel-Padding, `px-6` =
> `--spacing(6)`, dieselbe Größe wie `Card`s Innenabstand). Betrifft
> automatisch alle Listen-Tabellen (Inhalte, Benutzer, Rollen,
> Kategorien, Tags), da sie die geteilte `ui/table.tsx`-Komponente
> nutzen.

> **Update 2026-08-05 (einheitliches Kopfzeilen-Layout, mehr Abstand
> zur Liste):** Referenz war die Benutzer-Seite (Titel+Beschreibung
> links, "Neu"-Button rechts, **eine** Zeile, `flex items-center
justify-between`) – Inhalte/Rollen/Benutzer hatten dieses Muster
> bereits, Kategorien/Tags/Medien nicht:
>
> - Kategorien/Tags: Der "Neue Kategorie"/"Neuer Tag"-Button steckte
>   bisher **in** `TaxonomyManager`, als eigene rechtsbündige Zeile
>   **unterhalb** von Titel/Beschreibung. Aus der Komponente entfernt
>   und stattdessen auf Seiten-Ebene (`categories/page.tsx`,
>   `tags/page.tsx`) in dieselbe Zeile wie der Titel gesetzt – exakt
>   das Muster der anderen Listen-Seiten.
> - Medien: "Neuer Ordner"/"Datei hochladen" steckten in
>   `media-folder-browser.tsx`, in derselben Zeile wie das
>   Ordner-Breadcrumb (`flex-wrap justify-between`). Breadcrumb bleibt
>   in der Komponente (ändert sich je Ordner, gehört zur Navigation,
>   nicht zum Seitentitel), die beiden Buttons wandern auf Seiten-Ebene
>   in die Titel-Zeile (`media/page.tsx`).
>
> Zusätzlich der Abstand zwischen Titel-Zeile und Liste global von
> `gap-4` auf `gap-6` erhöht – auf allen Listen-Seiten (Inhalte,
> Medien, Kategorien, Tags, Benutzer, Rollen, Versionshistorie), nicht
> auf den Formular-Seiten (Content anlegen/bearbeiten, Einstellungen),
> da dort keine Liste direkt unter dem Titel folgt.

> **Update 2026-08-05 (Sidebar-Logo: doppeltes Padding + harter
> Textsprung beim Ein-/Ausklappen):** Zwei weitere, vom Nutzer direkt
> am Markup gefundene Fehler in der Logo-Kopfzeile
> (`app-sidebar.tsx`): (1) `SidebarHeader` (`ui/sidebar.tsx`) hat
> bereits eigenes `p-2` – die zusätzliche `px-2` auf dem inneren Div
> verdoppelte das horizontale Padding auf 16px pro Seite. Im
> eingeklappten Zustand (nur `3rem`/48px breite Schiene) sprengte das
> zusammen mit dem `w-8`-Logo-Quadrat (32px) die verfügbare Breite
> (16+32+16=64px > 48px) – entfernt, `SidebarHeader`s eigenes `p-2`
> reicht (ergibt exakt dieselben 48px wie bei den Nav-Buttons weiter
> unten). (2) Der Text "pivot CMS" nutzte
> `group-data-[collapsible=icon]:hidden` (`display:none`) – anders als
> die Nav-Item-Beschriftungen (die über die animierte Breiten-
> Verkleinerung des ganzen Buttons + `overflow-hidden` weich
> verschwinden) sprang der Logo-Text dadurch beim Ein-/Ausklappen
> abrupt weg, während die Sidebar selbst noch mitten in ihrer
> `duration-200`-Breiten-Transition war ("flippt"). Fix: `hidden`
> ersetzt durch `w-0 opacity-0` mit eigener, zur Sidebar passender
> `transition-[width,opacity] duration-200 ease-linear` – zusätzlich
> `gap-2` → `group-data-[collapsible=icon]:gap-0` (ebenfalls
> übergangsanimiert) auf dem umschließenden Flex-Container, sonst
> bliebe im eingeklappten Zustand eine Rest-Lücke zum jetzt
> nullbreiten Text stehen (hätte die 48px-Rechnung erneut gesprengt).

> **Update 2026-08-05 (Sidebar: mehr Abstand, ruhigere Animation, volle
> Breite auch eingeklappt, dauerhafter Ein-/Ausklapp-Zustand):**
>
> - `SIDEBAR_WIDTH_ICON` (`ui/sidebar.tsx`) von `3rem` auf `4.5rem`
>   erhöht – mehr Luft um die Icons im eingeklappten Zustand
>   (Referenz-Screenshot des Nutzers).
> - `SidebarMenu`s `gap-0` → `gap-1` (mehr Abstand zwischen den
>   Menüpunkten), Buttons selbst `py-2` → `py-3` **und** `h-8` → `h-auto`
>   (die feste `h-8` aus der `size`-Variante hätte das zusätzliche
>   `py-3` zusammen mit `overflow-hidden` sonst abgeschnitten, statt
>   sichtbar mehr Höhe zu erzeugen).
> - Der harte `!important`-Sprung beim Ein-/Ausklappen
>   (`group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!`)
>   aus der Basis-Komponente entfernt – `app-sidebar.tsx` steuert
>   Breite/Höhe/Rundung jetzt vollständig selbst über `navActiveClass`
>   (kein Kampf mehr zwischen `!important`-Basis-Klassen und eigenen
>   Overrides). Dadurch bleibt der aktive/Hover-Hintergrund
>   (`-mx-2 w-[calc(100%+1rem)]`, randlos + eckig) jetzt **auch im
>   eingeklappten Zustand** über die volle Breite erhalten (vorher per
>   `group-data-[collapsible=icon]:mx-0 w-8` auf ein kleines Quadrat
>   zurückgesetzt) – Icon wird bei fehlendem Text über
>   `group-data-[collapsible=icon]:justify-center` zentriert.
> - Alle Label-`<span>`s (Nav-Einträge, "Einstellungen", "Abmelden")
>   bekommen dieselbe weiche `w-0 opacity-0`-Transition wie zuvor schon
>   das Logo (`navLabelClass`), plus der interne Icon-Text-`gap-2`
>   kollabiert synchron auf `gap-0` – das "unruhige Flippen" kam daher,
>   dass zuvor nur der Button selbst schrumpfte (abrupt geclippt durch
>   `overflow-hidden`), während der Text ohne eigene Transition
>   mitgerissen wurde, statt synchron auszublenden.
> - **Ein-/Ausklapp-Zustand dauerhaft gespeichert**: Die shadcn-
>   `SidebarProvider`-Komponente schrieb bereits einen Cookie
>   (`sidebar_state`) bei jedem Umschalten, las ihn aber nie beim
>   initialen Server-Render zurück (`defaultOpen` war hart `true`) –
>   der Zustand ging nach jedem Reload verloren. `dashboard/layout.tsx`
>   liest den Cookie jetzt serverseitig (`cookies()` aus
>   `next/headers`) und reicht ihn als `defaultOpen` an
>   `SidebarProvider` durch.
>   **Stolperstein dabei**: Ein Versuch, den Cookie-Namen als
>   exportierte Konstante `SIDEBAR_COOKIE_NAME` aus `ui/sidebar.tsx` in
>   die Server-Component zu importieren, scheiterte auf nicht
>   offensichtliche Weise – `ui/sidebar.tsx` beginnt mit `"use client"`,
>   und **jeder** Export aus einer `"use client"`-Datei wird beim Import
>   in Server-Code von Next.js/React Server Components in eine
>   Client-Referenz umgewandelt (nicht nur Komponenten – auch simple
>   String-Konstanten). `typeof SIDEBAR_COOKIE_NAME` war zur Laufzeit
>   `"function"` statt `"string"`, wodurch der Cookie-Lookup lautlos
>   immer `undefined` lieferte (kein Fehler, einfach falsches
>   Verhalten). Gefunden über ein temporäres Server-seitiges
>   `console.log` im Dev-Server-Terminal. Fix: Cookie-Name in
>   `dashboard/layout.tsx` als Literal `"sidebar_state"` hartkodiert
>   (mit Kommentar, dass er mit `ui/sidebar.tsx` übereinstimmen muss)
>   statt über die Client/Server-Grenze zu importieren.

## Logo & Firmenangaben (2026-08-05)

Sidebar-Logo und "pivot CMS"-Text sind jetzt admin-konfigurierbar
statt hartkodiert: neuer Tab "Firma" in den Einstellungen erlaubt den
Upload eines Logos für den ausgeklappten Zustand (`logoExpandedUrl`,
ersetzt "pivot CMS"-Text) und eines für den eingeklappten Zustand
(`logoCollapsedUrl`, ersetzt die "S"-Verlaufs-Kachel), plus
Firmenangaben für Impressum/Datenschutz (Name, Adresse, Vertretung,
Kontakt, Handelsregister, USt-IdNr.). Ohne hochgeladenes Logo bleibt der
bisherige Fallback ("S"-Kachel + Text) erhalten. Volle technische
Details (Backend-Felder, Upload-Weg über den bestehenden Medien-
Endpoint, warum die Firmenfelder außerhalb des Zod-Schemas liegen) in
[settings-and-password-policy.md](../auth/settings-and-password-policy.md).

`app-sidebar.tsx` rendert beide Logo-Slots so, dass sie sich in den
bereits bestehenden weichen Ein-/Ausklapp-Übergang einfügen (derselbe
`w-0 opacity-0`-Mechanismus wie beim Label-Text, siehe oben) – kein
neuer Sonderfall, nur ein Bild statt Text/Icon als Inhalt desselben
Wrappers.

## Datei-Input-Styling (2026-08-06)

`ui/input.tsx`s `type="file"`-Variante nutzte für den nativen
"Datei auswählen"-Button (`::file-selector-button`, per Tailwind
`file:`-Variante gestylt) bisher `file:bg-transparent` – dadurch
verschmolz der Button optisch mit dem restlichen Eingabefeld (wo der
Dateiname erscheint) und wuchs unbegrenzt mit. Jetzt eigener
Hintergrund (`file:bg-muted`, farblich abgesetzt vom restlichen
`bg-transparent`-Input) und `file:max-w-40` (Text wird bei langen
Dateinamen im Button selbst abgeschnitten, `file:truncate`) – wirkt
global auf jedes Datei-Input im Projekt (Logo-Upload, Medien-Upload-
Dialog, Bild-Picker im Editor), da alle dieselbe `ui/input.tsx`-Basis
nutzen.

## Header-Hintergrund (2026-08-06)

`dashboard-header.tsx` hatte noch `bg-card` (weiß) + `border-b` aus der
ursprünglichen Umsetzung – seit Sidebar und Content-Fläche dieselbe
graue `--background`-Farbe teilen (siehe oben), wirkte der weiße Header
wie ein Fremdkörper. Auf `bg-background` umgestellt, `border-b`
entfernt (gleicher Grund wie beim Sidebar/Content-Übergang: bei
identischer Hintergrundfarbe wäre eine sichtbare Trennlinie ein
unnötiger Nahtstoß).

## Content-Editor-Formular (2026-08-06)

`content-editor-form.tsx` (geteilt zwischen "Neuer Inhalt" und "Inhalt
bearbeiten") nutzte bisher `max-w-2xl` und keinen Kachel-Hintergrund –
auf Wunsch an das übrige Design angeglichen: `max-w-2xl` entfernt (volle
Breite) und alle Formularfelder in eine `Card` (`rounded-2xl bg-card
shadow-card`) verschachtelt, exakt dieselbe Komponente wie die
Dashboard-Kacheln. Die innere "ContentType – Felder"-Box (dynamische
Felder je Content-Type) nutzte vorher einen eigenen `rounded-lg border`
– das hätte innerhalb der neuen äußeren Card wie eine Box-in-der-Box
gewirkt, daher auf ein rahmenloses `bg-muted/30`-Segment umgestellt, das
sich nur farblich, nicht durch eine zweite Kontur absetzt.

## Was wurde gebaut

Auf Vorgabe von Referenz-Screenshots eines Admin-Dashboard-Templates
("Brinhildr") wurde das visuelle Erscheinungsbild der gesamten
Dashboard-Oberfläche überarbeitet – Farben, Sidebar, Header, Karten,
Listen-Aktionen:

- **Theme-Farben** (`globals.css`): `--primary` (und abgeleitete Werte
  wie `--ring`, `--sidebar-primary`, `--chart-*`) von neutralem
  Schwarz/Weiß auf eine warme Koralle/Orange-Palette (`oklch(0.68 0.19
40)`) umgestellt – wirkt global, da praktisch jede Komponente
  (Buttons, Badges, Pagination-Hervorhebung, Fokus-Ringe) über
  Farb-Tokens statt Hardcoded-Werten läuft. `--radius` von `0.625rem`
  auf `0.85rem` erhöht (weichere Ecken überall, da alle `rounded-lg`/
  `rounded-xl`/etc.-Utilities relativ zu diesem Wert skalieren). Sowohl
  Light- als auch Dark-Mode-Variablen aktualisiert.
- **Sidebar** (`app-sidebar.tsx`): aktiver Nav-Eintrag bekommt eine
  Verlaufs-Pille (`bg-gradient-to-br from-orange-400 to-rose-500`,
  weißer Text) statt der neutralen `sidebar-accent`-Füllung – als
  zusätzliche `className` auf `SidebarMenuButton`, die generische
  `ui/sidebar.tsx`-Komponente selbst blieb unangetastet. Collapse-Trigger
  von der Topbar in den Sidebar-Header neben das Logo verschoben (Logo
  jetzt eigene Verlaufs-Kachel). Footer umgebaut: statt Avatar-Dropdown
  jetzt einfache Nav-Zeilen "Einstellungen" (weiterhin
  `settings:manage`-gated) und "Abmelden".
- **Neue Komponente `dashboard-header.tsx`**: ersetzt den bisherigen
  schlichten Header. Enthält Such-Input (rein visuell, kein Backend für
  eine globale Suche vorhanden – bewusst ohne Submit-Handler, siehe
  Stolpersteine), eine deaktivierte Glocke (Platzhalter, kein
  Benachrichtigungssystem vorhanden) und ein Avatar-Dropdown
  (Name+Rolle, Konto-Link, Abmelden) – letzteres ist die eigentliche
  funktionale Verlagerung des bisherigen Sidebar-Footer-Menüs.
- **`ui/card.tsx`**: `rounded-xl` → `rounded-2xl`, `ring-1` → zusätzlich
  `shadow-sm` (weicherer, "schwebender" Karten-Look statt reiner
  Kontur).
- **`ui/checkbox.tsx`**: `rounded-[4px]` → `rounded-full` (runde
  Checkboxen wie in der Referenz-Tabelle) – globale Änderung, wirkt auf
  alle Checkbox-Vorkommen (Massenauswahl-Spalten überall).
- **Zeilen-Aktionen in allen Listen-Ansichten** (Content, Medien,
  Benutzer, Rollen, Kategorien, Tags) von zwei/drei nebeneinander
  stehenden Icon-Buttons auf ein einziges Kebab-Menü (`MoreVertical`)
  umgestellt, das ein `DropdownMenu` mit "Bearbeiten"/"Löschen" (bzw.
  weiteren Aktionen wie "Verschieben" bei Medien) öffnet – exakt das
  bereits etablierte `folder-tile-menu.tsx`-Muster
  (siehe [media-folders.md](../media/media-folders.md#umbenennen-löschen-als-overlay-2026-08-04))
  jetzt konsequent auf alle übrigen Listen angewendet.

## Warum diese Lösung

- **Farb-Token-Änderung statt Component-für-Component-Neufärbung**: Da
  praktisch die gesamte UI bereits auf semantische CSS-Variablen
  (`--primary`, `--ring`, …) statt harter Farbwerte aufbaut, reicht eine
  zentrale Änderung in `globals.css`, um Buttons, Badges (`variant=
"default"`), Fokus-Ringe, aktive Pagination-Seite usw. konsistent
  umzufärben, statt jede Komponente einzeln anzufassen.
- **Kein neues Dashboard-Chart-Widget-Set**: Die Referenz zeigt
  e-commerce-spezifische Karten (Sales/Earnings/Top Products/Countries/
  Top Categories mit Chart-Bibliothek), die fachlich nicht zum
  CMS-Datenmodell passen (kein Umsatz, keine Bestellungen). Es wurde
  bewusst **keine** neue Chart-Bibliothek eingeführt und **keine**
  Fake-Widgets mit erfundenen Daten gebaut – das hätte gegen "keine
  halbfertigen/irreführenden Implementierungen" verstoßen. Übernommen
  wurde die **Formsprache** (Karten-Stil, Farben, Radius), nicht der
  konkrete Karteninhalt.
- **Kebab-Menü statt einzelner Icon-Buttons**: konsistente Umsetzung
  des bereits an einer Stelle (Medien-Ordner) etablierten und vom Nutzer
  gebilligten Musters auf alle übrigen Listen – vermeidet, dass zwei
  unterschiedliche Interaktionsmuster (einzelne Icons vs. Dropdown)
  parallel im selben Dashboard existieren.
- **Bestehende Edit-Dialoge um `hideTrigger` + kontrollierten
  `open`/`onOpenChange`-Modus erweitert** (`EditUserDialog`,
  `RoleFormDialog`, `TaxonomyItemDialog`, `MoveToFolderDialog`) statt
  neuer Komponenten – exakt dasselbe rückwärtskompatible Muster wie
  zuvor bei `ConfirmDeleteDialog`/`FolderDialog`. Alle bisherigen
  Aufrufstellen (z.B. `RoleFormDialog` als "Neue Rolle"-Button)
  funktionieren unverändert weiter.

## Stolpersteine / Besonderheiten

- **Bewusst unfertige/inerte Chrome-Elemente**: Such-Input und
  Glocken-Icon im neuen Header sind rein visuell (kein `onSubmit`, die
  Glocke ist `disabled`). Das ist ein bewusster Kompromiss zwischen "Design
  1:1 übernehmen" und "keine irreführende UI vortäuschen, die nichts
  tut" – ein deaktivierter Button täuscht keine Funktion vor, ein leeres
  Suchfeld ohne Wirkung wäre grenzwertiger, aber es gibt aktuell keine
  globale Such-API im Backend, die man sinnvoll dahinterschalten könnte.
- **Tailwind-Klassen-Merge-Reihenfolge**: Die Sidebar-Aktiv-Klassen
  (`data-active:bg-gradient-to-br …`) werden über `cn()`
  (`tailwind-merge`) mit den Basis-Klassen aus
  `sidebarMenuButtonVariants` gemischt – `tailwind-merge` erkennt
  gleiche Varianten-Präfixe (`data-active:`) und dieselbe
  Utility-Gruppe (`text-color`) korrekt und lässt die zuletzt übergebene
  `className` gewinnen, ohne dass die generische `ui/sidebar.tsx`
  angefasst werden musste.

## Relevante Dateien

- `apps/web/src/app/globals.css`
- `apps/web/src/components/app-sidebar.tsx`,
  `dashboard-header.tsx` (neu)
- `apps/web/src/app/dashboard/layout.tsx`
- `apps/web/src/components/ui/card.tsx`, `ui/checkbox.tsx`
- `apps/web/src/components/content-row-actions.tsx`,
  `media-card-actions.tsx`, `user-row-actions.tsx`,
  `role-row-actions.tsx`, `taxonomy-manager.tsx`
  (`TaxonomyRowActions`)
- `apps/web/src/components/edit-user-dialog.tsx`,
  `role-form-dialog.tsx`, `taxonomy-item-dialog.tsx`,
  `move-to-folder-dialog.tsx` (alle um `hideTrigger`/kontrollierten
  `open`-Modus erweitert)

> **Update 2026-08-17 (Augen-Icon in `PasswordInput` nicht vertikal
> zentriert):** "das auge bei passwort und grundsätzlich dargestellte
> icons in inputs müssen mittig" – `ui/password-input.tsx`s Toggle-Button
> nutzte `absolute inset-y-0 right-0 h-8 w-8`. `inset-y-0` setzt sowohl
> `top:0` als auch `bottom:0`; ist zusätzlich eine feste Höhe (`h-8`)
> gesetzt, wird `bottom` bei einem absolut positionierten Element mit
> widersprüchlichen Constraints ignoriert – der Button dockt oben an
> statt zentriert zu sein (sichtbar bei hohen Inputs, z.B. im
> "Zwei-Faktor-Authentifizierung deaktivieren"-Dialog). Fix: `top-1/2
-translate-y-1/2` statt `inset-y-0` – die Standard-Pattern für ein
> absolut positioniertes, vertikal zentriertes Element, bereits korrekt
> so verwendet beim Such-Icon in `block-editor-field.tsx` (Zeile mit
> `top-1/2 left-2.5 ... -translate-y-1/2`). Per Playwright-Bounding-Box
> verifiziert: Mittelpunkt von Input und Icon-Button exakt identisch
> (Differenz 0px). Codebase-weit war das die einzige Stelle mit diesem
> Muster – alle anderen Input-Icons (Such-Icons in Header/Command-Palette)
> sitzen als Flex-Kind in einem `items-center`-Container, kein eigenes
> `absolute`-Problem. **Regel für künftige Icon-in-Input-Fälle:** niemals
> `inset-y-0` mit einer festen Höhe kombinieren – entweder
> `top-1/2 -translate-y-1/2` (bei `absolute`) oder ein Flex-Container mit
> `items-center` verwenden.

> **Update 2026-08-29 (TabsList-Hintergrund fest statt Theme-Token):**
> Nutzervorgabe: "Tab Hintergrund in dunkel #2a2f38 und hell #eeeeee,
> global für alle Tabs". `tabsListVariants`s `default`-Variante
> (`ui/tabs.tsx`) nutzte bisher `bg-secondary` (siehe Update 2026-08-16
> unten) – das Token selbst wird aber auch von Badges, Buttons u.a.
> verwendet, eine Änderung dort hätte weiter ausgestrahlt. Stattdessen
> feste Werte direkt in der Variante: `bg-[#eeeeee] dark:bg-[#2a2f38]`.
>
> **Stolperstein:** drei Stellen (`privacy-view.tsx`, `company-view.tsx`,
> `mailing-settings-card.tsx`) übergeben `<TabsList className="... bg-
secondary ...">` und überschreiben damit die Komponenten-Variante direkt
> im Aufruf – die erste Fassung des Fixes blieb dadurch dort unsichtbar
> ("wo??? du hast nichts angezeigt?"). Notwendiger zweiter Schritt:
> `bg-secondary` aus allen drei `className`-Strings entfernt, damit der
> Variant-Default wieder greift. **Lehre:** bei einer Komponenten-Token-
> Änderung immer nach `<Komponente ... bg-`/`className=".*bg-` grep'en,
> nicht nur die Komponentendatei selbst anpassen – einzelne Call-Sites
> überschreiben Varianten gerne lokal.

> **Update 2026-08-30 (Sidebar-Breite vereinheitlicht):** Nutzervorgabe:
> "überall, wo rechts im Inhalt eine Sidebar oder weitere Kacheln sind,
> soll die Breite genauso behandelt werden wie bei Mein Konto" – dort
> ein proportionales `grid grid-cols-1 items-start gap-4 lg:grid-cols-3`
> mit `lg:col-span-2` fürs Hauptelement statt einer festen Pixel-Breite
> (`lg:grid-cols-[1fr_320px]`/`[1fr_360px]` u.ä.). In einem Rutsch
> angeglichen: Dashboard-Startseite (beide Kachel-Paare), Firma (beide
> Reiter), Betroffenenanfragen, Modul-Detailseite, Benachrichtigungen,
> Datenschutzvorfälle, sowie Datenschutz' Rechtstexte-/
> Auftragsverarbeiter-/DSB-Reiter. Bewusst ausgenommen (Nutzervorgabe):
> Seiten (`content-editor-form.tsx`) und Formular (`form-editor.tsx`) –
> deren Editor-Panel-Aufteilung ist ein anderes Muster, kein
> "Inhalt + Info-Sidebar". Gilt ab jetzt als Standard für jedes neue
> Layout dieser Art, nicht nur für die in diesem Durchgang angepassten
> Seiten.

## Offene Punkte

- Dashboard-Startseite zeigt weiterhin nur die einfachen Statistik-
  Karten (Content/Medien/Benutzer-Zahlen), keine Chart-Widgets wie in
  der Referenz – bewusst nicht nachgebaut, siehe oben.
- Keine echte globale Suche hinter dem Header-Suchfeld.
- Keine Benachrichtigungen hinter dem Glocken-Icon.
- `content-versions-list.tsx`s Lösch-Buttons wurden in diesem Batch
  nicht auf das Kebab-Menü umgestellt (dort gibt es ohnehin nur eine
  einzelne Löschen-Aktion pro Version, kein Bearbeiten – ein Menü für
  eine einzelne Aktion hätte keinen Mehrwert).

## Update 2026-08-31: eigener Rahmen-Token für Buttons

Nutzervorgabe: "alle Buttons mit weissem Hintergrund und Border ein ganz
wenig dunkler". Umgesetzt über einen **eigenen semantischen Token** statt
über eine Änderung an `--border`: `--color-button-border` (im
`@theme inline`-Block von `globals.css`) zeigt auf die bereits vorhandene
zweite Linienfarbe `--pivot-line2` (hell `#d8dee6` statt `#e6e6e6`, dunkel
`#3a4453` statt `#2d3542`) – es wurde also **keine neue Farbe erfunden**,
und Karten, Trenner und Eingabefelder behalten unverändert `--border`.

Angewendet auf:

- die `outline`-Variante in `ui/button.tsx` (der Regelfall),
- **145 handgeschriebene `<Button>`/`<button>`-Tags in 78 Dateien**, die
  `border-border` explizit mitgeben (Codemod über die öffnenden Tags),
- fünf Filter-Chips (`media-filters.tsx`, Suchseite) sowie die
  gestrichelten "Hinzufügen"-Flächen in `faq-groups-manager.tsx` und
  `gallery-editor.tsx`, deren Klassen in `cn()`-Ausdrücken stehen und
  vom Codemod nicht erfasst wurden.

**Nachtrag am selben Tag – Medien-Filter-Chips:** die inaktiven Chips auf
`/dashboard/media` (Typ-Filter und Rubrik-Filter, vier Stellen in
`media-filters.tsx`) standen auf `bg-transparent` und nahmen damit das
graue Seiten-Grau an. Nutzervorgabe: weißer Hintergrund, aktiver Zustand
unverändert – jetzt `bg-card` statt `bg-transparent`, der aktive Chip
bleibt `bg-dark-surface`. `bg-card` statt eines harten `bg-white`, damit
der Dark Mode weiter stimmt. Dieselbe Umstellung auf Nachfrage direkt
danach für die identischen Chips der Suchergebnis-Seite
(`app/dashboard/search/page.tsx`) – damit gibt es app-weit keinen
transparenten Chip dieser Bauart mehr.

**Bewusst nicht angefasst:** `border-t border-border` als Trennlinie
_innerhalb_ eines breiten Buttons (Datenschutz-/Vorfall-Panels) und
Info-Kästen mit `bg-muted` – beides sind keine weißen Button-Rahmen.
Im Dark Mode bleibt es bei `dark:border-input`, dort gibt es keine weißen
Flächen.
