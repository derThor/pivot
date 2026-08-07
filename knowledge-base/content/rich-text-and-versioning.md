# Rich-Text-Editor + Versions-Diff & Rollback

**Datum:** 2026-08-04
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/components/rich-text-editor.tsx`, `content-versions-list.tsx`,
`src/app/dashboard/content/[id]/versions`)

> **Update 2026-08-06 (HTML-Diff/Vorschau in Tabs):** Im
> Versions-Diff (`content-versions-list.tsx`) standen bei Richtext-
> Feldern bisher zwei Blöcke übereinander: der rohe HTML-Wort-Diff
> (Label = Feldname, z.B. "body") und darunter eine gerenderte
> Vorschau ("body – Vorschau (Stand dieser Version)"). Auf Nutzerwunsch
> jetzt in zwei Tabs zusammengefasst: "{feld} (HTML)" (roher Diff) und
> "Vorschau" (gerendert, read-only `RichTextEditor`). Nicht-Richtext-
> Felder (z.B. `title`) bleiben unverändert als einfacher Diff-Block
> ohne Tabs – Tabs ergeben nur Sinn, wo es tatsächlich zwei
> Darstellungsformen desselben Werts gibt. `FieldDiff` intern
> aufgeteilt in `DiffBox` (nur die eingefärbten Diff-Spans, ohne Label –
> wiederverwendbar im HTML-Tab) und `FieldDiff` (Label + `DiffBox`, für
> den Nicht-Tab-Fall). Sichtbarkeits-Logik ("nur anzeigen, wenn sich das
> Feld geändert hat") in eine gemeinsame `hasFieldChanged()`-Helper-
> funktion gezogen, damit sie für beide Darstellungen konsistent bleibt.
>
> **Zweites Update 2026-08-06 (Regression: leere Diffs bei
> unverändertem Body):** Das Tabs-Update oben führte einen echten Fehler
> ein, vom Nutzer gemeldet ("bei den Versionen sind immer leere Diffs,
> keine Inhalte mehr vorhanden"): die neue Sichtbarkeits-Prüfung
> (`if (!hasFieldChanged(...)) return null`) saß eine Ebene zu hoch –
> sie unterdrückte für Richtext-Felder nicht nur den HTML-Diff (korrekt,
> das war schon vorher so), sondern **auch die Vorschau**, sobald sich
> der Body zwischen einer Version und dem aktuellen Stand nicht geändert
> hatte (z.B. weil zwischen zwei Versionen nur der Status umgeschaltet
> wurde, nicht der Inhalt selbst). Vor dem Tabs-Update wurde die Vorschau
> für Richtext-Felder **immer** gerendert, unabhängig von `hasFieldChanged`
> – dieses Verhalten war beim Umbau versehentlich mit unter die neue
> Bedingung gerutscht. Fix: `hasFieldChanged`-Check nur noch für
> Nicht-Richtext-Felder (dort weiterhin über den internen Early-Return
> in `FieldDiff`, unverändert seit vor dem Tabs-Update); Richtext-Felder
> rendern die Tabs (Vorschau + HTML) jetzt wieder immer.
>
> **Drittes Update 2026-08-06 (Regression: Editor ließ sich nicht mehr
> bearbeiten):** Zweiter vom Nutzer gemeldeter Fehler im selben Zug
> ("ich kann nichts mehr im Editor ändern"), verursacht durch das
> Content-Locking-Feature (siehe
> [content-locking.md](./content-locking.md#stolpersteine--besonderheiten)
> für die volle Erklärung): `RichTextEditor.editable` änderte sich dort
> zum ersten Mal *nach* dem Mounten, was zwei latente Bugs im
> `useEditor()`-Aufruf aufdeckte – `editable` selbst wurde von Tiptap
> nach der Erstellung nicht mehr übernommen, und `onUpdate` war
> `editable ? … : undefined` und blieb dadurch dauerhaft `undefined`, da
> `editable` beim allerersten Render `false` war. Fix: `onUpdate` immer
> registrieren, zusätzlicher `useEffect` mit `editor.setEditable(editable)`.
> H1–H6, Code-Block, HTML-Quellcode-Ansicht, Bild einfügen (aus
> Medienbibliothek wählen oder direkt hochladen) + Ausrichtung. Details
> im Abschnitt "Editor-Erweiterung" unten.
>
> **Zweites Update 2026-08-04 (Bugfix + Nachschärfung):** Bilder wurden
> nicht angezeigt (relative statt absolute Medien-URL, siehe
> Stolpersteine), Bild-Ausrichtung war fälschlich als globale
> Toolbar-Buttons statt als Kontextmenü am Bild umgesetzt, und es fehlte
> eine echte Text-Ausrichtung. Alles behoben/ergänzt, siehe
> "Editor-Erweiterung (Nachschärfung)" unten.
>
> **Drittes Update 2026-08-04 (Bildgröße):** Bilder lassen sich jetzt per
> Ziehpunkt direkt im Editor in der Breite anpassen (`width`-Attribut +
> React-NodeView), siehe "Editor-Erweiterung (Bildgröße)" unten. Direkt
> im Anschluss zwei Bugfixes: ein CSS-Problem (Auswahl-Rahmen größer als
> das Bild) und der eigentliche Resize-Blocker (natives HTML5-Drag durch
> `draggable: true` im Image-Node-Schema hat den Ziehpunkt gekapert,
> Breite blieb dadurch effektiv immer auf dem CSS-Default hängen) – siehe
> Stolpersteine.
>
> **Viertes Update 2026-08-04 (Bugfix Bild-Upload-Dialog):** Ein neues
> Bild direkt im Editor hochladen hat ungewollt das gesamte
> Content-Formular mitgespeichert und den Dialog geschlossen –
> Ursache war ein fehlendes `stopPropagation()` auf einem verschachtelten
> Formular-Submit (Portal umgeht zwar das DOM, nicht aber Reacts
> synthetisches Event-Bubbling). Siehe Stolpersteine.
>
> **Fünftes Update 2026-08-04 (Bugfix Rahmen, endgültig):** Der
> Auswahl-Rahmen war trotz der Fixes aus dem dritten Update immer noch
> größer als das Bild. Ursache war eine vergessene alte CSS-Regel mit
> höherer Spezifität als die NodeView-eigenen Klassen – siehe
> Stolpersteine, "Rahmen war trotzdem noch größer als das Bild".
>
> **Sechstes Update 2026-08-04 (Rollback-Dialog + Rich-Text-Vorschau):**
> `ConfirmDeleteDialog` schloss sich nach erfolgreicher Bestätigung nicht
> selbst (betrifft alle Verwendungsstellen, nicht nur Rollback) – jetzt
> kontrolliert (`open`/`onOpenChange`) und schließt nach erfolgreichem
> `onConfirm()`. Zusätzlich: Die Versionshistorie zeigt bei
> `richtext`-Feldern jetzt zusätzlich zum Text-Diff eine formatierte
> Vorschau (echter `RichTextEditor` im `editable={false}`-Modus) statt
> nur rohem HTML-Text mit Diff-Markierungen. Details unten.
>
> **Siebtes Update 2026-08-04 (Versionen löschen):** Neuer Endpoint
> `DELETE /content/:id/versions/:versionId` + rechts angeordneter
> Löschen-Button pro Version + Massenauswahl in der Versionshistorie.
> Teil einer projektweiten Massenauswahl-Konvention für alle
> Listen-Ansichten, siehe
> [bulk-selection-and-delete.md](../frontend/bulk-selection-and-delete.md).
>
> **Achtes Update 2026-08-04 (Ordner im Bild-Picker):** Der
> `ImagePickerDialog` (Tab "Aus Medienbibliothek") unterstützt jetzt
> Ordner-Navigation (Breadcrumb + Kacheln), passend zu den neu
> eingeführten Medien-Ordnern, siehe
> [media-folders.md](../media/media-folders.md).

## Was wurde gebaut

- **Rich-Text-Editor**: `richtext`-Felder im Content-Editor rendern jetzt
  `RichTextEditor` (Tiptap Core + StarterKit, `@tiptap/react`) statt einer
  einfachen `Textarea`. Ausgabe ist ein HTML-String (`editor.getHTML()`),
  der unverändert in den bestehenden `dataValues`-State passt – keine
  Schema-Änderung an `Content.data`. Kleine Toolbar (Fett/Kursiv/
  Überschrift/Listen/Zitat/Rückgängig-Wiederholen), Styling manuell per
  Tailwind-Arbitrary-Selektoren auf die von Tiptap gesetzte `.tiptap`-
  Klasse (kein `@tailwindcss/typography`-Plugin installiert, bewusst
  nicht nachgezogen für ein paar Elemente).
- **Versionshistorie**: `ContentService.findOne()` lädt jetzt auch
  `createdBy` pro Version mit. Neu `GET /content/:id/versions`
  (paginiert, `content:update`-Recht) und `POST
  /content/:id/versions/:versionId/rollback` (ebenfalls
  `content:update`). Rollback sichert **zuerst** den aktuellen Stand als
  neue Version (gleiches Muster wie `update()`), setzt dann
  `Content.data` auf die Zieldaten – ein Rollback ist dadurch selbst
  wieder rückgängig machbar.
- Neue Seite `/dashboard/content/[id]/versions`: Liste aller Versionen
  (neueste zuerst, Datum + Bearbeiter), pro Version ein
  Diff-anzeigen/verbergen-Toggle mit Feld-für-Feld-Wortdiff (`diff`-Paket,
  `diffWords`) **gegen den aktuellen Live-Stand** (nicht paarweise
  chronologisch) sowie ein "Wiederherstellen"-Button.
  `ConfirmDeleteDialog` wurde dafür generalisiert (`confirmLabel`/
  `confirmingLabel`/`variant`-Props, Default unverändert "Löschen"/
  destructive) – vorher hätte die Wiederherstellen-Bestätigung
  fälschlich "Löschen" als Button-Text gezeigt.
- Link "Versionen anzeigen" auf der Content-Edit-Seite.

## Editor-Erweiterung (2026-08-04)

- **Überschriften H1–H6**: `StarterKit.configure({ heading: { levels:
  [1,2,3,4,5,6] } })` (Default ist nur `[1,2,3]`). Der bisherige feste
  H2-Button wurde durch ein `<Select>` ersetzt (aktueller Level per
  `editor.isActive('heading', {level})`-Schleife ermittelt, `"paragraph"`
  als Sonderwert für `setParagraph()`).
- **Code-Block**: `CodeBlock` ist standardmäßig Teil von StarterKit
  (`codeBlock !== false`), einfach ein Toolbar-Button ergänzt
  (`toggleCodeBlock()`), keine neue Abhängigkeit.
- **HTML-Quellcode-Ansicht**: lokaler `sourceMode`-State schaltet
  zwischen `<EditorContent>` (WYSIWYG) und einer `<Textarea>` mit dem
  rohen `editor.getHTML()`-String um. Beim Zurückschalten
  `editor.commands.setContent(sourceValue)` – läuft durch den normalen
  `onUpdate`-Pfad, synchronisiert also `dataValues` wie jede andere
  Änderung auch. Alle anderen Toolbar-Buttons werden im Quellcode-Modus
  deaktiviert (`disabled`), da sie auf eine WYSIWYG-Selektion wirken, die
  dort nicht existiert.
- **Bilder**: neue Abhängigkeit `@tiptap/extension-image`. Eigene
  `AlignableImage`-Extension (`Image.extend({ addAttributes ... })`) fügt
  ein `align`-Attribut hinzu (`left`/`center`/`right`, gerendert als
  `data-align`-HTML-Attribut) – bewusst **kein** `@tiptap/extension-
  text-align`, da dessen Ziel Text-/Absatzknoten sind, nicht Bildknoten.
  Ausrichtung per Tailwind-Arbitrary-Selektoren auf `[data-align=...]`
  (float+margin für links/rechts, `mx-auto`+`block` für zentriert).
- **Bild einfügen**: neue Komponente `ImagePickerDialog` mit zwei
  Tabs – "Aus Medienbibliothek" (lädt `GET /api/media`, Grid aus
  Thumbnails) und "Neu hochladen" (identisches Formular wie
  `MediaUploadDialog`, aber `POST /api/media`s Erfolgs-Response wird
  direkt als Bild eingefügt statt nur die Seite zu refreshen). Da beide
  Wege über den bestehenden `POST /media`-Endpoint laufen, erscheinen aus
  dem Editor hochgeladene Bilder automatisch auch unter
  `/dashboard/media` – keine Sonderlogik nötig.
- Dafür neue BFF-Route `GET /api/media` (`apps/web/src/app/api/media/
  route.ts`) – vorher gab es dort nur `POST`. Kein Backend-Change, `GET
  /media` (`media:read`) existierte bereits vollständig.

## Editor-Erweiterung (Nachschärfung, 2026-08-04)

Direkt im Anschluss an die obige Erweiterung meldete der Nutzer drei
Probleme, die alle in derselben Sitzung behoben wurden:

- **Bug: Bild wurde im Editor nicht angezeigt.** Ursache: `ImagePickerDialog`
  gibt `MediaItem.url` als **relativen** Pfad zurück (z.B.
  `/uploads/xyz.jpeg`, so wie ihn `POST /media` speichert). Dieser wurde
  unverändert an `editor.commands.setImage({ src: url })` durchgereicht –
  im Editor (gerendert auf dem Next.js-Origin, Port 3000) zeigte der
  `<img>`-Tag dadurch auf `http://localhost:3000/uploads/xyz.jpeg`, wo
  keine Datei liegt (Uploads werden vom NestJS-Backend auf Port 3001
  ausgeliefert). Fix: `mediaUrl()` aus `lib/media.ts` (der überall sonst
  im Projekt für genau diesen Zweck existiert, siehe
  [media-upload.md](../media/media-upload.md)) wird jetzt auch im
  `onSelect`-Callback des Editors angewendet, bevor `setImage()`
  aufgerufen wird.
- **Bild-Ausrichtung als Kontextmenü statt globaler Toolbar-Buttons.**
  Die ursprüngliche Umsetzung hatte drei immer sichtbare
  Ausrichtungs-Buttons in der Haupt-Toolbar, die auf `updateAttributes
  ('image', {align})` wirkten – ohne erkennbaren Bezug zu einem
  ausgewählten Bild und ohne Rückmeldung, wenn gar kein Bild selektiert
  war. Jetzt: `<BubbleMenu editor={editor} shouldShow={({editor}) =>
  editor.isActive('image')}>` aus `@tiptap/react/menus` (offizielle
  Tiptap-v3-React-Komponente für genau diesen Zweck, benötigt
  `@tiptap/extension-bubble-menu` als Peer-Dependency, aber **keine**
  manuelle Extension-Registrierung im `extensions`-Array – die
  React-Komponente kapselt das Plugin selbst). Die drei
  Ausrichtungs-Buttons erscheinen dadurch nur noch als schwebendes Menü
  direkt am Bild, sobald es angeklickt/selektiert ist.
- **Text-Ausrichtung (links/zentriert/rechts) als eigenes Feature.** Neue
  Abhängigkeit `@tiptap/extension-text-align`, konfiguriert für
  `types: ['heading', 'paragraph']` und auf drei Werte eingeschränkt
  (`alignments: ['left','center','right']`, ohne `justify`). Drei neue,
  immer sichtbare Toolbar-Buttons (gleiche Icons wie bei der
  Bild-Ausrichtung, aber bewusst an anderer Stelle – Haupt-Toolbar statt
  Bubble-Menu – da Text-Ausrichtung sich auf den aktuellen Absatz/die
  aktuelle Überschrift bezieht, nicht auf eine Node-Selektion wie beim
  Bild). Rendert `style="text-align: ..."` direkt inline auf dem
  Element – keine zusätzliche CSS-Regel nötig (anders als bei der
  Bild-Ausrichtung, die ein custom `data-align`-Attribut + eigene
  Tailwind-Selektoren braucht, weil `Image` kein eingebautes
  Style-Rendering für Attribute hat).
- Bild-Breite bei `left`/`right`-Ausrichtung auf `max-w-[50%]` begrenzt
  (vorher `max-w-full`), sonst hätte ein `float`-Bild ohne Platzreserve
  keinen sichtbaren Textumbruch erzeugt. `center`-Bilder bleiben bei
  `max-w-full`.

## Editor-Erweiterung (Bildgröße, 2026-08-04)

- Neues `width`-Attribut auf `AlignableImage` (Default `null` = natürliche
  Größe innerhalb der bestehenden `max-w`-Grenzen), gerendert als
  `style="width: X%"` direkt auf dem `<img>`-Tag im gespeicherten HTML –
  gleiches `renderHTML`/`parseHTML`-Muster wie `align`.
- Neue Komponente `resizable-image-node-view.tsx`: eine React-`NodeView`
  (`ReactNodeViewRenderer`, registriert über `AlignableImage.
  addNodeView()`) ersetzt für die **Editier-Ansicht** das Standard-
  Bild-Rendering. Wrapper-`<span>` (`NodeViewWrapper`) trägt
  `data-align`/Breiten-Style, das `<img>` füllt den Wrapper zu 100 %.
  Ist der Node selektiert (`selected`-Prop der NodeView), erscheint ein
  kleiner Ziehpunkt unten rechts – `pointerdown`/`pointermove`/
  `pointerup` auf `window` berechnen die neue Breite in Prozent der
  Breite des Elternelements (Editor-Content-Breite als Näherung) und
  rufen `updateAttributes({ width })` auf.
- **Wichtig:** Die `NodeView` bestimmt nur, wie das Bild **im Editor**
  aussieht/bedient wird. Das serialisierte HTML (`editor.getHTML()`,
  gespeichert in `Content.data`) kommt weiterhin aus dem Node-Schema
  (`renderHTML` der `align`/`width`-Attribute) – dadurch bleiben
  `data-align`/`style="width:…"` als reine Attribute auf dem `<img>`-Tag
  im gespeicherten HTML erhalten, unabhängig von der NodeView. Die
  bereits vorhandenen `[&_.tiptap_img[data-align=...]]`-CSS-Regeln in
  `EditorContent`s `className` griffen deshalb im Editor selbst nicht
  mehr für die `data-align`-Varianten (das `data-align` sitzt dort auf
  dem Wrapper-`<span>`, nicht mehr direkt auf dem `<img>`). Die
  unbedingte Basisregel (`[&_.tiptap_img]:max-w-[50%]`, ohne
  `data-align`-Bedingung) griff aber sehr wohl weiterhin – und zwar
  **falsch**: siehe Stolpersteine, "Rahmen war trotzdem noch größer als
  das Bild".

## Rollback-Dialog + Rich-Text-Vorschau in der Versionshistorie (2026-08-04)

- **`ConfirmDeleteDialog` schließt sich jetzt selbst nach erfolgreichem
  Bestätigen**: war zuvor unkontrolliert (`<AlertDialog>` ohne
  `open`/`onOpenChange`), wodurch die Komponente selbst keine Möglichkeit
  hatte, den Dialog nach einer erfolgreichen Aktion zu schließen. Jetzt
  `open`/`onOpenChange`-State in `ConfirmDeleteDialog` selbst, `setOpen
  (false)` nach erfolgreichem `await onConfirm()`. Betrifft alle
  Verwendungsstellen (Content/Medien/Kategorien/Tags/Benutzer/Rollen
  löschen, Rollback), nicht nur die Versionshistorie – am auffälligsten
  war es aber bei Rollback, weil dort (anders als bei Löschen) keine
  Zeile aus einer Liste verschwindet, die die fehlende Dialog-Schließung
  optisch kaschiert hätte.
- **Formatierte Vorschau für `richtext`-Felder in der Versionshistorie**:
  `RichTextEditor` bekommt eine neue optionale Prop `editable` (Default
  `true`). Bei `editable={false}` wird nur eine schreibgeschützte,
  toolbar-lose Variante gerendert (`useEditor({..., editable: false})`,
  kein `onUpdate`, kein `BubbleMenu`, kein `ImagePickerDialog`) – die
  gemeinsame Content-Styling-Klasse (`editorContentClassName`, aus dem
  bisherigen Duplikat zwischen den beiden `EditorContent`-Stellen
  extrahiert) sorgt dafür, dass die Vorschau exakt wie der echte Editor
  aussieht. `ContentVersionsList` bekommt eine neue Prop
  `richtextFields: string[]` und rendert für diese Felder zusätzlich zum
  bestehenden Wort-Diff eine `<RichTextEditor editable={false} value=
  {version.data[field]} />`-Vorschau. Die Feldtyp-Info kommt aus einer
  neuen `getContentType(id)`-Fetcher-Funktion (`GET /content-types/:id`,
  Backend existierte schon) – die Versions-Seite lädt den `ContentType`
  des Contents und filtert `schema.fields` auf `type === "richtext"`.

## Warum diese Lösung

- **Tiptap statt Plate/Lexical**: liefert HTML-Strings, passt ohne
  Schema-Bruch in `Content.data[feld]: string`. Slate/JSON-dokument-
  basierte Alternativen hätten einen Wechsel von String- auf
  strukturiertes JSON erzwungen, ohne dass dafür ein Bedarf genannt
  wurde.
- **Diff gegen aktuellen Stand statt chronologische Paar-Diffs**:
  beantwortet direkt die für einen Rollback relevante Frage ("was würde
  sich ändern, wenn ich hierher zurücksetze?") und ist deutlich
  einfacher als eine vollständige Diff-Kette über alle Versionen.
- **`ConfirmDeleteDialog` generalisiert statt eigene Komponente**: Die
  Komponente war laut ihrer eigenen Begründung
  ([ui-convention-crud-and-delete-confirmation.md](../frontend/ui-convention-crud-and-delete-confirmation.md))
  "nicht löschen-spezifisch, nur so benannt" – der hartkodierte
  "Löschen"-Text auf dem Bestätigen-Button widersprach dem aber. Drei
  optionale Props (mit unveränderten Defaults) lösen das, ohne
  bestehende Aufrufstellen anzufassen.
- **Rollback-Scope bleibt auf `Content.data` beschränkt**: `ContentVersion`
  snapshotet seit jeher nur `data`, keine Erweiterung auf Titel/Status/
  SEO-Felder – bestehende Systemgrenze, keine neue Einschränkung.

## Stolpersteine / Besonderheiten

- Tiptap v3 erwartet bei `setContent()` ein Options-Objekt
  (`{ emitUpdate?: boolean }`), nicht mehr die booleschen Positions-
  Argumente aus v2 – wichtig für den `useEffect`, der den Editor bei
  extern geänderten `value`-Props synchronisiert (z.B. beim Wechsel des
  Content-Types im Anlege-Formular, wodurch `dataValues` zurückgesetzt
  wird), ohne dabei selbst wieder ein `onUpdate` auszulösen
  (`emitUpdate: false`).
- **Leer-Erkennung**: ein leerer Tiptap-Dokument-HTML-String ist
  `<p></p>`, nicht `""`. `onUpdate` ruft deshalb bei `editor.isEmpty`
  bewusst `onChange("")` auf, damit die bestehende Pflichtfeld-Prüfung
  (`dataValues[field.name]?.trim()` in `content-editor-form.tsx`)
  unverändert weiterfunktioniert, ohne einen Rich-Text-Sonderfall in der
  Validierung zu brauchen.
- Route-Reihenfolge in `content.controller.ts`: `@Get(':id/versions')`
  kollidiert nicht mit dem bereits existierenden `@Get(':id')`, da
  NestJS/Express-Routen mit fester Segmentanzahl matchen – `:id` matcht
  nur genau ein Pfadsegment, `/content/:id/versions` hat zwei. Kein
  Umsortieren der bestehenden Routen nötig.
- **Auswahl-Rahmen war größer als das Bild** (`resizable-image-node-
  view.tsx`): Der `<img>` hatte unbedingt `width: 100%` seines Wrappers,
  während der Wrapper selbst (ohne manuell gesetzte `width`) per
  `inline-block`/`block` "shrink-to-fit" auf die Bildgröße schrumpfen
  sollte. Ein prozentual breites Kind (`img` mit `width:100%`) in einem
  Shrink-to-fit-Container ist ein klassisches CSS-Zirkularitätsproblem –
  Browser lösen das oft so auf, dass der Container die volle verfügbare
  (Deckel-)Breite annimmt statt auf die tatsächliche Bildgröße zu
  schrumpfen, wodurch der auf dem Wrapper liegende Auswahl-Rahmen
  sichtbar größer als das Bild wirkte. Fix: Die 50%/100%-Deckelung sitzt
  jetzt auf dem **Wrapper** (relativ zum umgebenden Absatz, keine
  Zirkularität), das `<img>` bekommt ohne manuelle Breite nur ein
  einfaches `max-w-full` (relativ zum Wrapper) statt einer festen
  Prozentbreite – dadurch schrumpft der Wrapper zuverlässig exakt auf die
  tatsächliche Bildgröße. Erst bei manuell gesetzter Breite (Ziehpunkt)
  trägt der Wrapper eine feste Breite und das Bild füllt ihn per
  `w-full` komplett aus (dort keine Zirkularität mehr, da die
  Wrapper-Breite dann explizit ist, nicht mehr "auto").
- **Resize hat trotzdem nicht funktioniert – Ursache lag woanders**:
  `@tiptap/extension-image`s Node-Schema setzt `draggable: true` (damit
  sich das Bild im Text per native HTML5-Drag-and-Drop verschieben
  lässt). Der von der `NodeView` gerenderte Wrapper übernimmt dieses
  `draggable="true"` automatisch. Ein `pointerdown` auf dem
  Ziehpunkt-Element (Kind des Wrappers) wurde dadurch vom Browser als
  Start eines nativen Bild-Drags interpretiert, nicht als mein eigener
  Resize – native Drags liefern keine `pointermove`-Events an das
  gedraggte Element, wodurch `updateAttributes({width})` nie mit
  sinnvollen Werten aufgerufen wurde und die Breite effektiv immer beim
  CSS-Default (z.B. 50 % bei links/rechts-Ausrichtung) hängen blieb – für
  den Nutzer sah das aus wie "Bild ist immer 50 % breit, lässt sich nicht
  ändern". Fix: `draggable={false}` + `onDragStart`-`preventDefault()`
  explizit auf dem Ziehpunkt-Element (verhindert natives Drag gezielt für
  dieses Kind-Element, das umgebende Bild bleibt weiterhin per
  Drag-and-Drop verschiebbar) sowie `event.stopPropagation()` im
  `pointerdown`-Handler.
- **Rahmen war trotzdem noch größer als das Bild** (nach den beiden
  obigen Fixes): Ursache war eine alte, aus der Vor-NodeView-Version
  stehen gelassene CSS-Regel `[&_.tiptap_img]:max-w-[50%]` in
  `EditorContent`s `className` (ohne `data-align`-Bedingung, trifft
  also **jedes** `<img>` in `.tiptap`). Sie wurde fälschlich für "totes
  Code" gehalten, weil die `data-align`-Varianten tatsächlich nicht mehr
  griffen – die unbedingte Basisregel griff aber sehr wohl weiter, und
  zwar mit **höherer CSS-Spezifität** als die von der NodeView selbst
  gesetzte `max-w-full`-Klasse: `.tiptap img` (Klasse + Tag-Selektor,
  Spezifität 0-1-1) schlägt `.max-w-full` (reine Klasse, Spezifität
  0-1-0) unabhängig von der Reihenfolge im Stylesheet. Das Bild blieb
  dadurch unabhängig vom NodeView-Zustand bei `max-width: 50%` hängen,
  während der Wrapper (Rahmen) korrekt größer werden konnte. Fix: die
  komplette alte `.tiptap img`-Regelgruppe aus `EditorContent`s
  `className` entfernt – Bild-Größe/-Ausrichtung wird jetzt
  ausschließlich von `ResizableImageNodeView` selbst über direkt am
  Element gesetzte Klassen gesteuert, keine zusätzliche globale
  CSS-Regel mehr, die (mit höherer Spezifität) dazwischenfunken könnte.
  **Lehre:** Bei einer Migration von CSS-Selektor-basiertem Styling auf
  eine Komponenten-/NodeView-eigene Styling-Strategie die alten
  Selektor-Regeln vollständig entfernen statt "vorsichtshalber" stehen
  zu lassen – "vermeintlich totes CSS" kann über Spezifität weiterhin
  aktiv eingreifen, auch wenn die ursprünglich gemeinte
  Attribut-Struktur (hier: `data-align` auf dem `<img>`) nicht mehr
  existiert.
- **Bild-Upload im Editor hat ungewollt das ganze Content-Formular
  gespeichert**: `ImagePickerDialog` liegt (`content-editor-form.tsx`'s
  `<form>` → `RichTextEditor` → `ImagePickerDialog`) innerhalb des
  äußeren Content-Formulars. Der Dialog wird zwar per Portal an anderer
  Stelle im echten DOM gerendert (kein natives HTML-"Formular-in-
  Formular"-Problem), aber React lässt Submit-Events trotzdem über den
  **React-Komponentenbaum** bubbeln, nicht nur über den echten DOM-Baum –
  ein Submit im inneren Upload-Formular erreichte dadurch zusätzlich den
  `onSubmit`-Handler des äußeren Formulars. `event.preventDefault()`
  allein verhindert nur die native Formular-Aktion, nicht das
  Weiterbubbeln des synthetischen Events. Fix: zusätzlich
  `event.stopPropagation()` im `onSubmit`-Handler des Upload-Formulars
  (`image-picker-dialog.tsx`). Gilt als generelles Muster: jedes
  `<form>` innerhalb eines Dialogs, der selbst innerhalb eines anderen
  `<form>` gerendert wird, braucht `stopPropagation()` im eigenen
  Submit-Handler.
- Live-Smoketest (curl, siehe unten) bestätigt den vollen Flow
  (Anlegen → zweimal Ändern → Versionsliste → Rollback → Zustand
  wiederhergestellt, überschriebener Stand als neue Version gesichert).
  Die eigentliche Editor-UI (Toolbar-Klicks, Diff-Darstellung im Browser)
  konnte in dieser Session nicht visuell getestet werden – kein
  Browser-Tool verfügbar. Type-Check ist sauber, alle Muster (BFF-Proxy,
  `ConfirmDeleteDialog`, Server-Component-Seiten) sind an anderer Stelle
  im Projekt bereits produktiv und getestet.

## Relevante Dateien

- `apps/web/src/components/rich-text-editor.tsx`
- `apps/web/src/components/image-picker-dialog.tsx`
- `apps/web/src/components/resizable-image-node-view.tsx`
- `apps/web/src/app/api/media/route.ts` (`GET` ergänzt)
- `apps/web/src/components/content-editor-form.tsx` (`richtext`-Zweig)
- `apps/api/src/content/content.service.ts` (`findVersions`, `rollback`)
- `apps/api/src/content/content.controller.ts`,
  `dto/query-content-versions.dto.ts`
- `apps/web/src/components/content-versions-list.tsx`
- `apps/web/src/app/dashboard/content/[id]/versions/page.tsx`
- `apps/web/src/app/dashboard/content/[id]/edit/page.tsx` (Link)
- `apps/web/src/app/api/content/[id]/versions/[versionId]/rollback/route.ts`
- `apps/web/src/components/confirm-delete-dialog.tsx`
  (`confirmLabel`/`confirmingLabel`/`variant`-Props, kontrolliertes
  `open`/Auto-Close)
- `apps/web/src/lib/api-server.ts` (`ContentVersion`,
  `getContentVersions`, `getContentType`)
- `apps/api/test/content-versions.e2e-spec.ts`

## Offene Punkte

- Keine HTML-Sanitization beim Ausliefern von Rich-Text-Inhalten nach
  außen – aktuell keine öffentliche Auslieferungsstelle im Repo (nur
  Backend + Admin-Dashboard).
- Rollback betrifft nur `Content.data`, nicht Titel/Status/SEO-Felder
  (Systemgrenze durch bestehendes `ContentVersion`-Schema).
- Keine Diff-Ansicht zwischen zwei beliebigen historischen Versionen,
  nur "Version vs. aktueller Stand".
- Diff arbeitet auf dem rohen HTML-String von `richtext`-Feldern (keine
  HTML-bewusste Diff-Darstellung) – für reine Textänderungen gut lesbar,
  bei reinen Formatierungsänderungen zeigt der Wortdiff auch die
  HTML-Tags als Änderung an.
- Nur Breiten-Resize per Ziehpunkt (Höhe ergibt sich proportional aus
  dem `<img>`-Seitenverhältnis), kein Zuschneiden/Cropping.
