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
> - **"drag and drop funktioniert aktuell nicht bei menü"**: Ursache war
>   nicht (nur) ein Bug, sondern vor allem die Semantik – ein Drop AUF
>   einen anderen Punkt verschachtelte den gezogenen Punkt darunter statt
>   ihn umzusortieren (unverändertes Verhalten aus der alten
>   `navigation-items-editor.tsx`, aber ohne die frühere Auf/Ab-Button-
>   Alternative fiel das jetzt als "geht nicht" auf). Fix:
>   `handleDropOnto` (nisten) durch `handleDropOnSibling(target, "before"
>   | "after")` ersetzt – beim `onDragOver` wird per `clientY` relativ zur
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
- Content-Picker im "Eintrag hinzufügen"-Dialog ist eine flache Liste
  ohne Live-Suche/Filterung – bei vielen Inhalten unhandlich, siehe
  Stolpersteine.

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
