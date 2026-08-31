# Navigationsverwaltung (Menüs)

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/navigation`), apps/web
(`src/components/{navigation-dialog,navigation-explorer,
navigation-item-dialog}.tsx`, `src/app/dashboard/navigation/`)

> **Update 2026-08-16 (Eine Seite statt Liste + Detailseite, 1:1 nach
> Bildvorlage):** "nun bauen wir menüs wie auf dem bild exact so um" –
> bisher zwei Seiten: Tabellen-Liste aller Menüs
> (`navigations-manager.tsx`) + eigene Detailseite
> `/dashboard/navigation/[id]` (`navigation-items-editor.tsx`) für die
> Einträge. Beide Komponenten und die `[id]`-Route entfernt, ersetzt
> durch eine einzige Seite mit neuer `navigation-explorer.tsx`:
>
> - **Links ein Menü-Umschalter** (Karten mit Name + Eintragsanzahl,
>   aktiv = Lime-Hintergrund), URL-getrieben per `?menu=<id>` – exakt
>   dasselbe Muster wie `?folder=` bei der Medien-Bibliothek. Server
>   Component (`page.tsx`) fällt auf das erste Menü zurück, wenn der
>   Query-Parameter fehlt oder ein gelöschtes Menü referenziert (kein
>   client-seitiger Redirect nötig).
> - **Rechts die Einträge des ausgewählten Menüs direkt sichtbar**,
>   keine Navigation zu einer eigenen Detailseite mehr nötig. Kopfzeile
>   "{Name} · Einträge" + Bearbeiten-/Löschen-Icons fürs Menü selbst
>   (Nutzerentscheidung: im rechten Header statt Hover auf der linken
>   Karte, damit die linke Liste aufgeräumt bleibt).
> - **`NavigationItemDialog` bekam einen Bearbeiten-Modus** (vorher nur
>   Anlegen/POST): optionaler `item`-Prop füllt das Formular vor und
>   schaltet auf PATCH `/navigations/:id/items/:itemId` um – der
>   Backend-Endpoint dafür existierte bereits (`updateItem` im Service),
>   war nur noch nicht ans Frontend angebunden.
> - **Reihenfolge nur noch per Drag & Drop** (Grip-Handle), die
>   bisherigen Auf/Ab-Pfeil-Buttons entfallen ersatzlos (Bildvorlage
>   zeigt nur Drag-Handle + Bearbeiten/Löschen-Icons,
>   `RowActionButtons`-Muster wie im Rest der App). Das "Untereintrag
>   hinzufügen"-Plus (in der Bildvorlage nicht sichtbar, aber
>   bestehende Funktionalität) wandert in den `extra`-Slot von
>   `RowActionButtons`, vor Bearbeiten/Löschen.
> - **Verschachtelung visuell verdeutlicht** (Nutzervorgabe, zweiter
>   Nachtrag: "Verschachtelung sichtbarer machen"): Kind-Einträge
>   stehen jetzt in einem eigenen `border-l-2 border-dashed`-Container
>   (gestrichelte Verbindungslinie + Einrückung), statt nur per
>   `margin-left` optisch abgesetzt zu sein wie zuvor. Jede Eintrag-Zeile
>   hat außerdem jetzt einen leichten Rahmen (`border-border/60`), vorher
>   nur `bg-muted/60` ohne Border.
> - Linke Menü-Karte auf `lg:w-80` verbreitert (Nutzerkorrektur, war
>   zunächst `lg:w-64`); außerdem `lg:self-start` ergänzt, da sie sonst
>   als Flex-Geschwister der rechten (höheren) Einträge-Karte auf deren
>   volle Höhe gestreckt wurde (`align-items: stretch` ist der
>   Flex-Default) – wirkte wie unnötig viel Leerraum unten in der
>   Menü-Liste, wenn nur wenige Menüs existieren.
>
> **Nachbesserung 2026-08-16 (Drag & Drop funktionierte nicht, Baum-Linie
> zu hell):**
>
> - **"drag and drop funktioniert aktuell nicht bei menü"**: Ursache war
>   nicht (nur) ein Bug, sondern vor allem die Semantik – ein Drop AUF
>   einen anderen Punkt verschachtelte den gezogenen Punkt darunter statt
>   ihn umzusortieren (unverändertes Verhalten aus der alten
>   `navigation-items-editor.tsx`, aber ohne die frühere Auf/Ab-Button-
>   Alternative fiel das jetzt als "geht nicht" auf). Fix:
>   `handleDropOnto` (nisten) durch `handleDropOnSibling(target, "before"
| "after")` ersetzt – beim `onDragOver` wird per `clientY` relativ zur
>   Zielzeile ermittelt, ob über der oberen oder unteren Hälfte
>   losgelassen wird, der gezogene Punkt landet danach als **Geschwister**
>   vor/nach dem Ziel (inkl. Wechsel der Verschachtelungs-Ebene, falls
>   das Ziel eine andere Elternebene hat). Verschachteln bleibt weiterhin
>   möglich, aber nur noch bewusst über den separaten "+"-Button je Zeile,
>   nicht mehr als Nebeneffekt eines normalen Drops. Da der
>   `/items/reorder`-Endpoint `sortOrder`-Werte 1:1 übernimmt (keine
>   automatische Verschiebung anderer Geschwister, siehe
>   `NavigationService#reorderItems`), sendet der Client jetzt die
>   **komplette neue Geschwister-Liste** mit neu durchnummerierten
>   `sortOrder`-Werten (0..n), nicht nur den verschobenen Punkt.
>   **Test-Stolperstein**: Ein per Skript synchron gefeuertes
>   `dragstart`→`dragover`→`drop` (ohne Pause dazwischen) reproduziert das
>   Problem NICHT zuverlässig testen – React committet den State-Update
>   aus `dragstart` (`setDraggedId`) erst beim nächsten Render, ein
>   `onDrop`-Handler, der synchron direkt danach im selben Skript-Tick
>   feuert, sieht in seiner Closure noch den alten (`null`) Wert und
>   bricht per Guard-Klausel früh ab. Mit ~200ms Pause zwischen den
>   simulierten Events (realistischer für eine echte Nutzer-Drag-Geste,
>   die durchgehend `dragover` feuert) funktioniert es zuverlässig – per
>   CDP mit `new DragEvent(...)` + `element.dispatchEvent(...)`
>   verifiziert (PATCH `/items/reorder` → 200, Punkt wandert korrekt aus
>   der Verschachtelung auf die oberste Ebene).
> - **"die linie ... muss dunkler sein, ich sehe die nicht"**: Baum-
>   Verbindungslinien nutzten `border-border` (im Light-Theme sehr hell/
>   fast unsichtbar) – auf `border-muted-foreground/50` geändert (deutlich
>   kontrastreicher, bleibt aber theme-fähig für Dark Mode).
> - **"die linie muss runter und dann nach rechts zum menüpunkt"**: aus
>   der reinen seitlichen `border-l`-Linie (kein horizontaler Abzweig) ein
>   echter Baum-Konnektor gemacht – durchgehende vertikale Linie plus pro
>   Kind-Zeile ein eigener horizontaler Abzweig (`absolute`, `-left-4`,
>   `border-t-2 border-dashed`) nach rechts zur jeweiligen Zeile.
>
> **Nachbesserung 2026-08-16, Teil 2 ("ich kann keine links mehr
> verschachteln" / "ich möchte menüs unendlich verschachteln können"):**
> Die "vor/nach"-Umsortierung (siehe oben) hatte das bisherige "Drop AUF
> einen Punkt = verschachteln" komplett ersetzt – zu weit gegangen, der
> Nutzer wollte beides. Fix: **drei Drop-Zonen pro Zeile** (Notion-/
> VS-Code-Explorer-Muster, per `onDragOver` anhand des Verhältnisses von
> `clientY` zur Zeilenhöhe bestimmt) – oberstes Viertel = davor
> einsortieren, unterstes Viertel = danach einsortieren, mittlerer
> Bereich (50%) = als Unterpunkt verschachteln (`handleDropNest`, neu,
> setzt `parentId` auf die Ziel-ID). Verschachtelungstiefe ist weiterhin
> **unbegrenzt** (`parentId`-Selbstreferenz im Datenmodell, keine
> Tiefenprüfung im Code) – per Drag&Drop-Simulation mit zwei
> aufeinanderfolgenden Verschachtelungen (2 Ebenen tief) verifiziert.
> **Test-Stolperstein**: Ein reiner Text-Reihenfolge-Vergleich
> (`p.font-semibold`-Inhalte in DOM-Reihenfolge) kann "verschachtelt"
> nicht von "unverändert an gleicher Position" unterscheiden, wenn das
> genestete Element direkt auf seinen neuen Elternknoten folgte – die
> flache Text-Liste sieht in beiden Fällen identisch aus. Erst das
> Mitschneiden der tatsächlichen `PATCH .../items/reorder`-Request
> (`parentId`-Feld im Body) zeigt zuverlässig, ob wirklich verschachtelt
> wurde.
>
> **Nachbesserung 2026-08-16, Teil 3 (Drag & Drop funktionierte in
> echten Browsern GAR NICHT, nur die Simulation hatte es vorgetäuscht):**
> Nutzer-Report "ich kann nichts ziehen. wie kommst du drauf, das es
> funktioniert. ich halte und ziehe, nichts passiert" – zurecht: die
> vorherige Verifikation hatte `new DragEvent(...)` +
> `element.dispatchEvent(...)` genutzt, das feuert React-Handler direkt,
> ohne die native Browser-Drag-Operation überhaupt zu durchlaufen. Ein
> echter Test mit `Input.dispatchMouseEvent` (mousePressed, mehrere
> mouseMoved-Schritte, mouseReleased – wie ein echter Maus-Drag) zeigte:
> `dragstart` feuert, dann sofort `dragend` – nie `dragover`, nie `drop`.
> Ein React-freier Kontrolltest (statisches HTML, identische
> Maus-Simulation) bewies, dass CDP echte native Drags grundsätzlich
> korrekt simulieren kann – der Fehler lag also wirklich im Code.
>
> **Ursache**: die "Hierher ziehen, um auf die oberste Ebene zu
> verschieben"-Zone war per `!draggedId && "hidden"` (`display: none` zu
> `block`) ein-/ausgeblendet – genau im Moment von `dragstart` (wenn
> `setDraggedId` läuft) erscheint sie und schiebt die gesamte
> Einträge-Liste darunter per Reflow nach unten. Chrome bricht eine
> aktive native Drag-Operation sofort ab, sobald sich das Layout unter
> dem Cursor durch einen Reflow verschiebt – exakt das beobachtete
> Muster (dragstart, dann sofort dragend).
>
> **Fix**: die Drop-Zone liegt jetzt als `absolute inset-x-0 bottom-full`
> Overlay über der Einträge-Liste (in einem `relative`-Wrapper), nicht
> mehr normal im Fluss – ein absolut positioniertes Element verschiebt
> beim Erscheinen/Verschwinden nie die Position anderer Elemente, also
> kein Reflow mehr, kein Drag-Abbruch mehr. Per echter
> Maus-Drag-Simulation verifiziert: dragstart, mehrere dragover, drop,
> Reorder-Request mit korrektem `parentId`.
>
> **Lehre für alle künftigen Drag&Drop-Features**: Elemente, die exakt
> beim Start eines Drags ein-/ausgeblendet werden (Drop-Zonen-Hinweise,
> Hilfstexte etc.), dürfen niemals per `display`/`hidden` togglen, wenn
> sie im normalen Dokumentfluss stehen – das verschiebt Geschwister-
> Elemente und bricht jede gerade aktive native Drag-Operation im Browser
> sofort ab. Immer als `position: absolute`-Overlay (kein Reflow für
> Nachbarn) umsetzen. Echtes Drag&Drop lässt sich außerdem NUR über
> `Input.dispatchMouseEvent`-Sequenzen (mousePressed, mouseMoved ×n,
> mouseReleased) verlässlich per CDP testen – `new DragEvent()` +
> `dispatchEvent()` überspringt die native Browser-Drag-Verarbeitung
> komplett und kann kaputte Interaktionen fälschlich als "funktioniert"
> durchwinken.
>
> **Nachbesserung 2026-08-16, Teil 4 (separate Root-Drop-Zone entfernt,
> Baum-Linie darf nicht über den letzten Punkt hinauslaufen):**
>
> - "das mit der obersten ebene anders regeln. einfach zwischen den
>   äußersten menüs ziehen und dann ist es auf erster ebene und
>   gleichzeitig sortiert" – die separate "Hierher ziehen, um auf die
>   oberste Ebene zu verschieben"-Zone (samt `handleDropOnRoot`,
>   `isRootDragOver`) komplett entfernt: die bestehende Vor/Nach-Logik
>   (`handleDropOnSibling`) übernimmt beim Ziel bereits automatisch
>   dessen `parentId` – bei einem Drop zwischen zwei Top-Level-Punkten ist
>   das `null`, der gezogene Punkt landet also ohnehin auf der obersten
>   Ebene UND an der richtigen Position, ganz ohne eigenes UI-Element.
>   Nebeneffekt: entfernt auch das Reflow-Risiko dieses Elements komplett
>   (siehe Teil 3), statt es nur zu entschärfen. Per echter
>   Maus-Drag-Simulation verifiziert: ein 2 Ebenen tief verschachtelter
>   Punkt landet nach Drop aufs untere Viertel eines Top-Level-Punkts
>   korrekt mit `parentId: null` auf oberster Ebene.
> - "wenn kein weiteres menü, dann sollen die striche nicht weiter runter
>   gehen": die vertikale Baum-Linie lag bisher auf dem gemeinsamen
>   Kinder-Wrapper (volle Höhe), lief beim letzten Kind also sichtbar über
>   dessen horizontalen Abzweig hinaus ins Leere weiter. Fix: die
>   vertikale Linie liegt jetzt pro Kind-Zeile einzeln (`h-full` bei al-
>   len außer dem letzten Kind, `h-1/2` beim letzten – endet exakt an
>   dessen horizontalem Abzweig).

## Was wurde gebaut

- Neue Modelle `Navigation` (Name/Slug) und `NavigationItem` (Label,
  genau eines von `contentId`/`externalUrl`, `parentId` für **beliebig
  tiefe Verschachtelung**, `sortOrder`), eigenes Modul `src/navigation/`.
- CRUD unter `/v1/navigations`, gegated über `settings:manage`
  (site-weite Struktur-Konfiguration, analog Webhooks – siehe
  [publishing-automation.md](./publishing-automation.md)).
- `POST/PATCH .../items` validiert **genau ein** Ziel (Seite/Inhalt ODER
  externe URL, nie beides/keins), `PATCH .../items/reorder` mit
  Batch-weitem Zyklen-Schutz (siehe Stolpersteine).
- Neue Seiten `/dashboard/navigation` (Liste aller Menüs) und
  `/dashboard/navigation/[id]` (Detail: Name/Slug bearbeiten, Einträge
  hinzufügen/verschachteln/umsortieren/löschen, Ziel-Auswahl aus einer
  flachen Inhalte-Liste). Menüpunkt "Navigation" in der Sidebar unter
  "Inhalte".

## Warum diese Lösung

- **Mehrere benannte Menüs statt eines einzigen globalen Baums**:
  explizite Nutzerentscheidung bei Rückfrage – man legt z.B.
  "Hauptmenü" und "Footer" als eigenständige Bäume an, Einträge
  innerhalb eines Menüs lassen sich beliebig tief verschachteln.
- **`content:read`/eigenständige Content-Zuweisung statt eigener
  Seitenbaum-Hierarchie**: ein früherer Versuch dieses Features hatte
  zusätzlich eine eigene Parent-/Child-Struktur direkt am `Content`-
  Modell (`parentId`/`sortOrder`/`path`, verschachtelte URLs wie
  `/eltern/kind`) eingeführt – auf ausdrücklichen Nutzerwunsch wieder
  entfernt ("das jetzige macht keinen Sinn ... ändere es so, das man
  menüs erstellen kann und die endlos verschachteln kann"). Die
  Organisation läuft jetzt **ausschließlich** über die Menü-Struktur;
  `Content` selbst hat keine eigene Hierarchie oder verschachtelte URL
  mehr (zurück zur ursprünglichen, flachen `@@unique([slug, locale])`).
  Siehe "Verworfener Ansatz" unten.

## Verworfener Ansatz (2026-08-06, noch am selben Tag zurückgebaut)

Erste Umsetzung von Roadmap-Punkt 2b.8 baute zwei parallele Systeme:
einen "Seitenbaum" (`Content.parentId`/`sortOrder`/`path`,
`GET /content/tree`, `PATCH /content/reorder`, eigene Baum-UI unter
`/dashboard/content/tree`, `AppSettings.homepageContentId` für eine
Startseiten-Markierung) **und** die hier beschriebene
Navigationsverwaltung nebeneinander. Nutzer-Feedback: diese Trennung
war nicht nachvollziehbar ("ich verstehe das mit der navigation und
seitenbaum nicht. das macht für mich keinen sinn"). Der Seitenbaum
wurde komplett zurückgebaut (Migration
`20260806210000_remove_content_hierarchy`, Rückkehr zu
`@@unique([slug, locale])`), die Navigationsverwaltung blieb als
alleinige Organisationsstruktur bestehen. Der zugehörige alte
Wissenseintrag (`content-hierarchy-and-navigation.md`) wurde in diese
Datei überführt.

**Lehre für künftige Roadmap-Punkte mit mehreren Teilaspekten**: wenn
ein Roadmap-Punkt wie "Seitenbaum mit Navigation" mehrere, für den
Nutzer möglicherweise redundant wirkende Konzepte bündelt, lohnt sich
eine Rückfrage zum genauen Scope **vor** der Implementierung (wurde bei
diesem Feature verpasst – die Klärung kam erst nach dem ersten,
kompletten Durchgang).

## Stolpersteine / Besonderheiten

- **Batch-Zyklenschutz bei Drag&Drop**: eine einzelne Verschiebung kann
  isoliert betrachtet gültig aussehen, aber in Kombination mit anderen
  Verschiebungen im selben Reorder-Batch einen Zyklus bilden (A wird
  Kind von B, B wird im selben Aufruf Kind von A).
  `NavigationService.reorderItems()` baut deshalb zuerst eine
  "Override-Map" aus dem gesamten Batch und läuft jede Eltern-Kette
  **inklusive dieser Overrides** ab, bevor irgendetwas geschrieben wird.
- **Lösch-Verhalten der Verschachtelung**: `NavigationItem.parent` nutzt
  `onDelete: SetNull` – löscht man einen Eintrag mit Untereinträgen,
  werden die Kinder nicht mitgelöscht, sondern rücken auf die oberste
  Ebene der Navigation.
- **Content-Auswahl im Dialog ist eine flache, auf 100 Einträge
  begrenzte Liste** (`getContentList({ pageSize: 100 })`), kein
  dedizierter Suchendpoint – bei mehr als 100 Inhalten müsste hier
  nachgerüstet werden (bewusst pragmatisch für den aktuellen
  Projektumfang).

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Navigation`,
  `NavigationItem`), Migration
  `20260806190000_add_content_hierarchy_and_navigation` (Navigation-Teil
  weiterhin gültig; der Content-Hierarchie-Teil wurde durch die
  Rollback-Migration `20260806210000_remove_content_hierarchy` wieder
  entfernt)
- `apps/api/src/navigation/` (komplettes Modul: `navigation.module.ts`,
  `navigation.controller.ts`, `navigation.service.ts`, `dto/`)
- `apps/web/src/lib/api-server.ts` (`NavigationSummary`,
  `NavigationDetail`, `NavigationItemNode`)
- `apps/web/src/app/api/navigations/**` (BFF-Routen)
- `apps/web/src/components/navigation-dialog.tsx`,
  `navigations-manager.tsx`, `navigation-item-dialog.tsx`,
  `navigation-items-editor.tsx`
- `apps/web/src/app/dashboard/navigation/{page.tsx,[id]/page.tsx}`
- `apps/web/src/components/app-sidebar.tsx` (Menüpunkt "Navigation"
  unter "Inhalte")
- `apps/api/test/navigation.e2e-spec.ts` (15 Tests: CRUD,
  Permission-Gating, Ziel-Validierung, Verschachtelung, Zyklen-Schutz,
  Cascade-Löschen)

## Offene Punkte

- Kein Deep-Link/Highlight für Menü-Einträge aus der globalen Suche
  (Navigation ist aktuell kein eigener Suchbereich).

## Update 2026-08-21: Live-Suche im Content-Picker

Auf die Frage "was sollten wir bei dem menü noch hinzufügen?" →
"mach es": der Content-Picker im "Eintrag hinzufügen"/"bearbeiten"-Dialog
(`navigation-item-dialog.tsx`) war eine flache, serverseitig auf 100
Einträge begrenzte `<Select>`-Liste (`getContentList({ pageSize: 100 })`)
ohne Filterung – bei vielen Seiten unhandlich, und Inhalte jenseits der
ersten 100 waren gar nicht auswählbar.

Ersetzt durch eine neue `ContentPicker`-Komponente (Such-als-du-tippst,
gleiches Muster wie `header-search.tsx`: 300ms Debounce, Mindestlänge 3
Zeichen, Klick-außerhalb schließt und verwirft ungespeicherte Eingaben).
Nutzt den bereits vorhandenen, bis dahin ungenutzten Endpoint
`GET /content/search` (Postgres-Volltextsuche, siehe
`ContentService.search()`) über die ebenfalls bereits vorhandene, bis
dahin ungenutzte BFF-Route `/api/content/search` – kein Backend-Codeänderung
nötig, beides existierte schon für einen anderen (nie gebauten) Zweck.

**Stolperstein**: der erste Entwurf hielt die aktuell ausgewählte
`contentId` über ein `useEffect`, das bei Divergenz zwischen Eingabetext
und Auswahl `onChange("", "")` an die Elternkomponente meldete – das löste
bei jedem Tastendruck einen Eltern-Re-Render mit neuem `key` aus (siehe
unten) und setzte damit das gerade getippte Zeichen sofort wieder zurück,
unmöglich zu tippen. Fix: die Elternkomponente hält den zuletzt
bestätigten Titel (`contentTitle`) und reicht ihn über `key={contentTitle}`
an `ContentPicker` durch – ein Remount passiert dadurch **nur** nach einer
echten Auswahl (`select()`) oder einem Formular-Reset, nie während des
Tippens. Unbestätigter Text wird stattdessen beim Weg-Klicken
(`handleClickOutside`) lokal auf den letzten bestätigten Titel
zurückgesetzt, ganz ohne Zustandsänderung in der Elternkomponente.

`contentItems` (weiterhin `getContentList({ pageSize: 100 })`) wird nur
noch für die Anfangsbefüllung des Titels beim Bearbeiten bestehender
Einträge gebraucht (`contentTitleById[item.contentId]`) – verweist der
Eintrag auf einen Inhalt jenseits der ersten 100, bleibt das Feld beim
Öffnen leer (bekannte, unveränderte Einschränkung wie zuvor).

**Nachbesserung, gleicher Tag ("so muss ich ja genau wissen, wonach ich
suchen will. blöd")**: eine reine Server-Suche ohne Browse-Möglichkeit war
eine echte Verschlechterung gegenüber der alten `<Select>`-Liste – man
musste den Titel vorher kennen, statt einfach durch die vorhandenen
Inhalte zu blättern. Fix: `ContentPicker` bekommt zusätzlich `browseItems`
(dieselbe `contentItems`-Liste). Ohne Eingabe bzw. unterhalb
`MIN_QUERY_LENGTH` (3 Zeichen) zeigt das Dropdown diese Liste
client-seitig gefiltert (leerer Suchtext = komplette Liste, wie die alte
`<Select>`); ab 3 Zeichen übernimmt weiterhin die echte Server-Suche
(deckt auch Inhalte jenseits der 100er-Grenze ab). Browsen und Suchen
schließen sich damit nicht mehr aus.

**Nachbesserung, gleicher Tag ("das ist nicht gut", Screenshot eines
aufgeblähten Dialogs mit innerem Scrollbalken, Buttons aus dem
sichtbaren Bereich geschoben)**: das Dropdown war ein selbstgebautes
`absolute`-Div _innerhalb_ des Dialog-Inhalts – da der Dialog eine
begrenzte Höhe mit eigenem Scroll hat, wuchs der Dialog-Inhalt beim
Öffnen des Dropdowns mit, statt frei darüber zu schweben. Alle anderen
Dropdowns/Selects der App sind dafür portaliert (rendern in
`document.body`, siehe [[feedback_portal_scoped_css]] und
`select.tsx`/`dropdown-menu.tsx`).

Fix: neue, wiederverwendbare `components/ui/combobox.tsx` als Wrapper um
Base UIs `@base-ui/react/combobox`-Primitive (bislang ungenutzt in
diesem Projekt, aber bereits in der `@base-ui/react`-Abhängigkeit
enthalten) – analog zu `select.tsx`, aber mit echtem Eingabefeld statt
nur Trigger-Button. `ContentPicker` nutzt jetzt `Combobox`/
`ComboboxInput`/`ComboboxContent`/`ComboboxList`/`ComboboxItem`/
`ComboboxEmpty`/`ComboboxStatus` statt des `absolute`-Divs; die
Browse-/Live-Suche-Logik von der vorherigen Nachbesserung bleibt
unverändert, nur `items={visibleResults}` + `filter={null}` (deaktiviert
Base UIs eigene interne Filterung, da schon extern vorgefiltert wird)
werden jetzt an die Combobox-Root durchgereicht statt manuell gerendert.

**Stolperstein**: `onValueChange` (Auswahl bestätigen) und `onOpenChange`
(Popup schließen) feuern bei einem Klick auf einen Eintrag im selben
React-Batch, Reihenfolge nicht garantiert. Das bisherige "Getipptes ohne
Auswahl verwerfen"-Zurücksetzen (`setQuery(initialTitle)` in
`onOpenChange`) konnte dadurch die gerade in `onValueChange` gesetzte
neue Auswahl wieder überschreiben, mit dem alten (noch nicht per
Re-Render aktualisierten) `initialTitle`-Wert. Fix: ein `justSelectedRef`
(kein State, kein zusätzlicher Render) markiert eine echte Auswahl, das
Zurücksetzen in `onOpenChange` prüft und überspringt sich dann selbst.

**Noch nicht im Browser verifiziert** (kein Browser-Zugriff in dieser
Session) – Tastatur-Navigation und exakte Popup-Positionierung sollten
vor dem nächsten Rollen-/Rechte- oder ähnlichen Picker-Einsatz einmal
real getestet werden, auch wenn Typecheck/Lint/Server-Kompilierung
sauber sind.

## Update 2026-08-17: Menü-Sidebar an "Rollen & Rechte"-Look angeglichen

`navigation-explorer.tsx`s linke Menü-Liste zeigte volle grüne Pillen
(`bg-primary text-primary-foreground`, einzeilig Name+Zähler
nebeneinander) – auf Nutzerwunsch 1:1 an das Sidebar-Muster von
`roles-explorer.tsx` angeglichen: Kopfzeile "Menüs · N" als Label statt
Pille, Einträge per `divide-y` getrennt, aktive Auswahl über linken
4px-Akzentbalken + `bg-primary/15`-Tönung statt Vollfüllung, Name/Zähler
zweizeilig untereinander statt nebeneinander. Kartenbreite von `lg:w-80`
auf `lg:w-72` angepasst (Rollen-Wert). Rein optische Änderung, keine
Verhaltensänderung.

## Update 2026-08-31: Startseite wird am Menüpunkt gesetzt

Die öffentliche Website (`apps/site`, siehe
[public-website.md](../frontend/public-website.md)) hatte bisher keine
Wurzel-URL: das URL-Schema kennt nur `/{slug}` (freie Seite) und
`/{kategorie}/{slug}` (Beitrag), nichts davon beantwortet, was unter `/`
liegt. Angeboten waren vier Orte für diese Entscheidung (Einstellungen →
Frontend, Menüpunkt, Seiten-Editor, magischer Slug); **Nutzerentscheidung
2026-08-31: am Menüpunkt** – "unter Menü dann auf einem Menüpunkt setzen.
das soll mit Badge geflaggt werden und nur einmal vergeben werden dürfen.
wenn man einen anderen Menüpunkt setzt, wird automatisch die aktuell
ausgewählte Seite abgewählt und die neue gewählt."

**Datenmodell:** `NavigationItem.isHomepage` (Boolean, Default `false`).
Bewusst **keine** DB-Unique-Regel: "höchstens ein `true` in der ganzen
Tabelle" ist als partieller Index in Prisma nicht ausdrückbar. Die
Exklusivität setzt `NavigationService.updateItem()` in einer Transaktion
durch – erst `updateMany({ isHomepage: true, id: { not: itemId } })` auf
`false`, dann den neuen Punkt setzen. Dadurch gibt es nie zwei
Startseiten, auch nicht kurzzeitig.

**Regeln:**

- Nur Menüpunkte mit **Inhalts-Ziel** können Startseite sein; bei einem
  externen Link antwortet die API mit 400. Ein Startseiten-Punkt, dessen
  Ziel nachträglich auf eine externe URL umgestellt wird, verliert die
  Markierung automatisch mit – sonst zeigte `/` ins Leere.
- Menü-übergreifend: es gibt genau eine Startseite pro Installation, egal
  in welchem Menü der Punkt liegt.
- Die Startseite darf auch ein Beitrag (Inhalt **mit** Kategorie) sein –
  das URL-Schema bleibt davon unberührt, `/` ist dann nur ein zweiter,
  kanonischer Zugang zu diesem Inhalt.

**UI (`navigation-explorer.tsx`):** Haus-Icon-Button in der Zeilen-
Aktionsleiste (nur bei Inhalts-Zielen sichtbar, `bg-primary/15` wenn
aktiv) plus derselbe Eintrag im mobilen "…"-Menü; der markierte Punkt
trägt ein `badge--lime`-Badge "Startseite" (gleiche Optik wie
"Aktuell"/"Aufmacher" an anderer Stelle). Ein Klick auf einen anderen
Punkt genügt – der Server wählt den bisherigen ab, `router.refresh()`
zeigt das Badge danach nur noch an der neuen Stelle.

**Tooltips in der Zeile (Nutzervorgabe, 2026-08-31):** die Menü-Zeile
trägt inzwischen bis zu vier Icon-Buttons nebeneinander (Startseite,
Untereintrag, Bearbeiten, Löschen) – ohne Beschriftung nicht
selbsterklärend. `RowActionButtons` hat dafür ein neues, **standardmäßig
ausgeschaltetes** `tooltips`-Flag bekommen (nur die Menü-Verwaltung setzt
es, alle übrigen Listen bleiben unverändert). Zwei Details dabei:

- Base UI erwartet beim `render`-Muster einen Trigger ohne eigene Kinder –
  das Icon hängt am `TooltipTrigger`, der Button wird childless
  übergeben (Vorbild: `user-restore-button.tsx`).
- Der "Untereintrag hinzufügen"-Button ist deshalb kein Dialog-Trigger
  mehr, sondern setzt `addChildTarget` und nutzt dieselbe kontrollierte
  Dialog-Instanz wie der mobile "…"-Eintrag: ein Element kann nicht
  gleichzeitig Dialog-Trigger und Tooltip-Trigger sein, ohne die
  `render`-Ketten ineinander zu schachteln.

**API-Auswirkungen:**

- `PATCH /navigations/:id/items/:itemId` akzeptiert `isHomepage`.
- `GET /public/home` (neu) liefert den Inhalt der Startseite; 404, solange
  keiner markiert ist oder dessen Seite nicht veröffentlicht ist –
  bewusst **kein** Fallback auf irgendeine andere Seite.
- `GET /public/pages/:slug` und `/public/categories/:slug/:contentSlug`
  liefern zusätzlich `path`: der kanonische Pfad, für die Startseite `/`
  statt `/{slug}`. Sonst wäre derselbe Inhalt unter zwei URLs mit zwei
  verschiedenen Canonicals erreichbar (Duplicate Content).
- `GET /public/navigation/:slug` verlinkt den Startseiten-Punkt auf `/`.
- `GET /public/sitemap.xml` führt die Startseite als `/`.

**Aktivitäten-Protokoll:** `navigation.homepage_set` /
`navigation.homepage_unset` (`describe-audit-action.ts`) – die erste
protokollierte Aktion dieses Moduls überhaupt; die übrigen
Menü-Änderungen bleiben bewusst unprotokolliert, das wäre eine eigene,
größere Änderung. Für Einstellungen/Benachrichtigungen/Datenschutz ist
nichts zu tun: die Entscheidung wurde bewusst **aus** den Einstellungen
herausgehalten, sie erzeugt keine Benachrichtigung und verarbeitet keine
personenbezogenen Daten.

**Stolperstein bei der Verifikation:** `GET /public/navigation/:slug`
filtert Menüpunkte mit unveröffentlichtem Ziel-Inhalt heraus – Kinder
eines herausgefilterten Punktes verschwinden dabei mit, auch wenn ihr
eigener Inhalt veröffentlicht ist. Das ist bestehendes Verhalten (nicht
neu), fiel hier aber auf, weil der zuerst getestete Startseiten-Punkt
unter einem Entwurf hing und deshalb gar nicht im öffentlichen Menü
auftauchte.

**Offen:** `AppSettings.mainNavigationId` ("Hauptmenü") liegt seit dem
Frontend-Schritt 1 in der Datenbank, hat aber weiterhin **kein
Eingabefeld** in den Einstellungen – nötig für den Header von `apps/site`
(Schritt 5 des Frontend-Plans).
