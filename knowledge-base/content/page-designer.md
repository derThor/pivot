# Seiten-Designer: Modul-Typen + Gutenberg-artiger Block-Editor

## Was

Neuer Feldtyp `"modules"` in `ContentType.schema` (parallel zu
`string`/`text`/`richtext`/`number`). Ein Content-Editor-Formular-Feld
dieses Typs rendert kein normales Input, sondern einen eigenen **"Design"-
Tab** (nur vorhanden/aktiv, wenn der Content-Type ein `"modules"`-Feld
hat – Standard-Tab beim Öffnen, noch vor "Einstellungen"/"SEO") mit einem
Block-Editor nach dem Vorbild von WordPress Gutenberg: links eine
**permanent sichtbare** Palette aller `ModuleType`s (Icon + Name je
Kachel, Suchfeld zum Filtern – die Typen müssen sofort sichtbar sein,
nicht hinter einem Menü versteckt), rechts die Seiten-Fläche mit den
Blöcken in fester Reihenfolge. Bausteine werden **ausschließlich per
Drag&Drop** von der Palette an eine beliebige Stelle zwischen zwei
Blöcken gezogen (**kein** Klick-Fallback zum Einfügen – das wurde
explizit verworfen, siehe Vorläufer unten) und sofort mit
**Beispiel-/Dummy-Inhalt** vorbefüllt (Lorem-Ipsum-Text, ein
eingebettetes Dummy-Bild, ein Beispiel-Button-Label – siehe `example` in
"Echte Inhalts-Vorschau" unten), damit man sofort sieht, wie der
Baustein ungefähr aussieht, statt eine leere Fläche zu haben. Die Fläche
selbst ist eine **reine, nicht editierbare Vorschau** ("wie es wirklich
aussieht"); bearbeitet wird ausschließlich über ein **Popup-Fenster**
(Klick auf den Block oder den Stift-Button in seiner Toolbar), das alle
Felder – Inhalt **und** Einstellungen wie Alt-Text/Link-Ziel – als
beschriftetes Formular zeigt. Reihenfolge wird per Pfeil-Buttons im
Block verschoben. Es gibt **keine** freie x/y-Positionierung.

`Content.data[fieldName]` wird für ein `"modules"`-Feld zu einem
geordneten Array `ModuleInstance[]`, die Reihenfolge im Array **ist** die
Darstellungsreihenfolge:

```json
[
  {
    "id": "block-1",
    "moduleTypeId": "cm...",
    "values": { "content": "<p>...</p>" }
  }
]
```

## Backend

- Neues, eigenständiges Prisma-Modell `ModuleType` (`id, name, slug, icon,
  schema, createdAt, updatedAt`) – **kein** Content-Type-Feld, sondern
  eine eigene, global wiederverwendbare Liste von Baustein-Definitionen.
  `schema` hat dieselbe Form `{fields:[{name,type,required}]}` wie
  `ContentType.schema`.
- `ModuleTypesModule`/`Controller`/`Service`: **read-only** (`GET
  /module-types`, `GET /module-types/:id`), keine eigene
  Permission-Gate über die globale JWT-Guard hinaus – exakt dasselbe
  Muster wie `ContentTypesController` (Content-Typen sind ebenfalls nur
  lesbar, Pflege ausschließlich über `seed.ts`). Bewusst **keine**
  Verwaltungs-UI für Modul-Typen gebaut – neue Bausteine anzulegen
  bedeutet aktuell: Eintrag in `seed.ts` ergänzen + `prisma db seed`.
- `Content.data` selbst bleibt `Json` – keine Schema-Änderung an
  `Content` nötig, das Array landet einfach als Wert eines Feldes darin
  (wie jedes andere Feld auch).

## Frontend

- Die Palette ist ab `md:` sticky (`md:sticky md:top-4`, `self-start` auf
  dem Flex-Item – ohne `self-start` würde der Flex-Standard `align-items:
  stretch` das Palette-Element auf volle Zeilenhöhe strecken und `sticky`
  hätte dadurch keinen Bewegungsspielraum). Zusätzlich `md:max-h-[calc
  (100vh-2rem)] md:overflow-y-auto`, damit bei vielen Modul-Typen alle
  weiterhin erreichbar/auswählbar bleiben, statt unten aus dem sichtbaren
  Bereich zu laufen. Die Rich-Text-Editor-Toolbar (`rich-text-editor.tsx`)
  ist aus demselben Grund `sticky top-0 z-10 bg-background` – bleibt bei
  langen Texten beim Scrollen innerhalb des Editors sichtbar.
  **Stolperstein:** `overflow-y-auto` erzwingt laut CSS-Spec automatisch
  auch `overflow-x: auto` (nicht `visible`), sobald eine Achse nicht
  `visible` ist – ein zusätzliches `overflow-x-visible` daneben wird vom
  Browser ignoriert. Der große `shadow-card` (`0 20px 40px`) der
  Paletten-Kacheln wurde dadurch sichtbar hart abgeschnitten. Fix:
  Paletten-Kacheln nutzen jetzt das kleinere `shadow-md` statt
  `shadow-card` (passt ohnehin besser zu einer kompakten Kachel als der
  für große Karten gedachte, dramatische Schatten), zusätzlich `md:p-2`
  auf dem scrollenden Container als Sicherheitsabstand.
- `apps/web/src/components/block-editor-field.tsx` – der Block-Editor,
  zweispaltig: links `Input`-Suchfeld + Grid aus draggable Icon+Name-
  Kacheln je `ModuleType` (immer sichtbar, **nur** per `draggable`/
  `onDragStart` einfügbar – bewusst **kein** `onClick`-Fallback mehr auf
  den Paletten-Kacheln, siehe Vorläufer unten). Rechts die Blöcke in
  fester Reihenfolge, dazwischen dünne `DropZone`-Leisten (`onDragOver`/
  `onDrop`, orange highlight). `DropZone` bekommt den rohen
  `dataTransfer`-Payload-String (`new:<moduleTypeId>` beim Einfügen aus
  der Palette, `move:<instanceId>` beim Umsortieren) und `handleDropAt()`
  im Elternteil unterscheidet beide Fälle. Jeder Block selbst ist
  ebenfalls `draggable` (Umsortieren geht **nur** per Drag&Drop im
  Content – **keine** Auf/Ab-Pfeile mehr, die gab es in einem früheren
  Anlauf, wurden aber explizit verworfen). Kein permanentes Icon/Name-
  Label mehr über dem Block – nur die reinen Inhaltsfelder
  (`BlockFieldOutput`, kein Input/Textarea/`onChange` – nur Anzeige,
  siehe "so wie die Vorschau aussehen" unten). Erst bei Hover/Fokus
  erscheint eine schwebende Leiste (`absolute -top-3 left-2`, per
  `group-hover`/`group-focus-within` eingeblendet) mit Greif-Symbol,
  Modul-Icon+Name, Stift (Bearbeiten) und Papierkorb (Entfernen). Klick
  auf den Block (oder den Stift) öffnet das Bearbeiten-Popup.
- `apps/web/src/components/block-field-output.tsx` (neu, geteilt) – die
  eigentliche "wie sieht das Feld wirklich aus"-Logik pro Feldtyp
  (image/richtext/text/string, inkl. `variant`-Styling), **gemeinsam**
  genutzt von `block-editor-field.tsx` (mit `showPlaceholders`) und der
  öffentlichen Vorschau-Seite `preview/[token]/page.tsx` (ohne
  Platzhalter) – bewusst eine einzige Quelle, nachdem die beiden Stellen
  einmal auseinandergelaufen sind (siehe Bug-Abschnitt unten).
- `apps/web/src/components/rich-text-display.tsx` (neu, geteilt) – reines
  `dangerouslySetInnerHTML` mit Tiptap-kompatibler Typografie, aber ohne
  Rahmen/Hintergrund-Chrome, für schreibgeschützte Rich-Text-Anzeige
  (Gegenstück zu `<RichTextEditor editable={false} />`, das weiterhin
  einen sichtbaren Rahmen behält – für echte "Vorschau" ungeeignet).
- Eigener Tab "Design" in `content-editor-form.tsx` (nur gerendert, wenn
  `moduleFields.length > 0`), Standard-Tab beim Öffnen für Content-Typen
  mit `"modules"`-Feld – zeigt **nur** den Block-Editor, keine
  Titel/Slug/Status/Kategorien-Felder daneben (die liegen im
  "Einstellungen"-Tab). `activeTab`-State plus ein `useEffect`, der beim
  Wechsel auf einen Content-Type ohne `"modules"`-Feld automatisch von
  "design" auf "settings" zurückspringt (der Tab existiert dann nicht
  mehr).
- `apps/web/src/components/module-field-input.tsx` – rendert **alle**
  Felder eines Bausteins (Inhalt + Einstellungen, in Schema-Reihenfolge)
  im Bearbeiten-Popup als beschriftetes Formular (string/text/number/
  richtext/image; `image` öffnet über einen eigenen Vorschau-Button die
  bestehende `ImagePickerDialog`). Auf der Design-Fläche selbst wird
  **nichts mehr editiert** – dort übernimmt `BlockFieldOutput` (siehe
  oben) die rein lesende Anzeige der Inhaltsfelder (ohne `option`-Felder
  wie Alt-Text/URL, die sind nur im Popup sichtbar).
- `content-editor-form.tsx`: `moduleValues` ist bewusst ein **eigener**
  State (`Record<string, ModuleInstance[]>`), getrennt von `dataValues`
  (`Record<string,string>`). Grund: `dataValues` wird an vielen Stellen
  (Autosave, Draft-Restore, Submit) als reiner String-Typ angenommen;
  das aufzuweiten hätte das Regressionsrisiko in dieser bereits zweimal
  betroffenen Datei unnötig erhöht. Autosave/Draft-Wiederherstellung
  deckt Modul-Werte deshalb aktuell **nicht** ab (bewusste Lücke, kein
  Bug).
- Die rechte Rich-Text-Karte im zweispaltigen Content-Tab-Layout
  (`editorFields`-Card) wird nur noch gerendert, wenn der Content-Type
  tatsächlich ein `richtext`-Feld hat. Hat er nur ein `"modules"`-Feld
  (wie "Seite"), fällt das Grid auf eine Spalte zurück und der
  Block-Editor ist die alleinige Haupt-Editier-Fläche darunter – analog
  zu Gutenberg, wo es kein zusätzliches Rich-Text-Feld über dem
  Block-Canvas gibt.

## Echte Inhalts-Vorschau, Bearbeitung nur im Popup

`ContentTypeField` (gemeinsamer Typ für `ContentType.schema.fields` UND
`ModuleType.schema.fields`) hat drei zusätzliche, nur für Modul-Felder
relevante, optionale Eigenschaften:

- **`option?: boolean`** – Feld ist eine Einstellung (z.B. `url` beim
  CTA-Button, `altText` bei Bild-Bausteinen), kein sichtbarer Inhalt.
  Solche Felder werden von `BlockPreview` **nicht** auf der Fläche
  gerendert (dort wären sie ohnehin nicht "echt sichtbar" – ein Alt-Text
  erscheint auf einer echten Webseite auch nicht als Text). Sie tauchen
  aber wie alle anderen Felder im Bearbeiten-Popup auf.
- **`variant?: "button" | "quote" | "caption"`** – reiner CSS-Hinweis für
  `BlockPreview` in `block-editor-field.tsx`, damit z.B. das `label`-Feld
  des CTA-Buttons wie ein echter, ausgefüllter Button aussieht statt wie
  reiner Text, und `quote`/`author` beim Zitat wie ein Blockzitat mit
  Bildunterschrift. **Kein** echtes Rendering der späteren Frontend-Optik
  – pivot ist headless, das konsumierende Frontend hat sein eigenes
  Styling. Die Variante ist nur eine Annäherung im Editor.
- **`example?: string`** – Beispielwert, mit dem `insertAt()` in
  `block-editor-field.tsx` eine frisch eingefügte Modul-Instanz
  vorbefüllt (`exampleValues(moduleType)`), statt mit einem leeren
  `values: {}` zu starten. Direkt nach dem Einfügen (per Drag&Drop aus
  der Palette) sieht man dadurch einen realistischen Dummy-Inhalt statt
  einer leeren Fläche: klassischer Lorem-Ipsum-Text bei Rich-Text/Zitat,
  ein eingebettetes Platzhalter-Bild (`data:image/svg+xml,...`, offline-
  sicher statt eines externen Placeholder-Dienstes) beim Bild-Baustein,
  "Jetzt entdecken" beim CTA-Button, "Max Mustermann" als Zitat-Autor.

Neuer Feldtyp **`"image"`** (bisher liefen Bild-URLs als `type: "string"`
– reines Text-Feld, keine echte Bildvorschau). `BlockFieldOutput` rendert
ein `"image"`-Feld rein lesend: gesetzt → echtes `<img>`, leer (nur im
Editor, `showPlaceholders`) → gestrichelter Platzhalter "Kein Bild".
Editiert wird nur im Popup: `ModuleFieldInput` zeigt dort eine
anklickbare Bildfläche, die die bereits bestehende `ImagePickerDialog`
öffnet (Medienbibliothek + Upload, gleiche Komponente wie beim OG-Bild in
den SEO-Feldern) statt einer rohen URL-Eingabe. `lib/media.ts` bekam
dafür `resolveImageSrc()` (neben dem bestehenden `mediaUrl()`): ein
`imageUrl`-Wert kann entweder das eingebettete `data:`-Dummy-Bild oder
eine echte, von der Medien-API gelieferte relative URL sein – nur
Zweiteres darf mit `API_ORIGIN` verkettet werden, ein `data:`/`http(s):`-
Wert wird unverändert durchgereicht (sonst entsteht ein kaputtes
`http://localhost:3001data:image/...`).

## Kritischer Bug: öffentliche Vorschau-Seite rendert Bausteine nicht

`apps/web/src/app/preview/[token]/page.tsx` existierte schon **vor** dem
Seiten-Designer und wurde beim Bau des Block-Editors nicht mitgezogen.
Symptom (Nutzer-Screenshot): Editor zeigt Bild- und Rich-Text-Baustein
korrekt, der über den Vorschau-Link aufgerufene öffentliche Link zeigt
aber nur den Titel und ein zweites Mal den Titel in einer Box – keine
Bausteine, kein Bild, kein Text. *"das ist falsch"*.

Zwei unabhängige Ursachen, beide gefixt:

1. **Filter verwarf Arrays.** Die alte Seite rendere jedes `data`-Feld
   generisch via `Object.entries(content.data).filter(([, v]) => typeof
   v === "string")` – funktionierte, solange jedes Feld ein String war.
   `data.blocks` ist aber ein **Array** von `ModuleInstance`, fällt durch
   den Filter und wurde komplett ignoriert. Fix: `isModuleInstanceArray()`
   erkennt Array-Felder anhand ihrer Form (`moduleTypeId`+`values` je
   Eintrag) und rendert sie über dieselbe `BlockFieldOutput`-Komponente,
   die auch der Editor nutzt (aus `block-editor-field.tsx` heraus in eine
   **gemeinsame** Datei `block-field-output.tsx` extrahiert, damit Editor-
   Vorschau und öffentliche Seite nie wieder auseinanderlaufen können).
2. **`GET /module-types` war nicht öffentlich erreichbar.** Um zu wissen,
   welche Felder eines Bausteins `option`/`variant` sind, muss die
   Vorschau-Seite die Modul-Typen kennen – aber `ModuleTypesController`
   verlangte (wie `ContentTypesController`) einen JWT, und die
   Vorschau-Seite ist bewusst **anonym** aufrufbar (Zugriff nur über den
   signierten Token, kein Login). `getModuleTypes()` im Frontend nutzte
   zudem `apiFetch()` (liest den Login-Cookie, gibt ohne ihn sofort
   `null` zurück) statt `publicApiFetch()`. Fix: `ModuleTypesController`
   bekam `@Public()` (Klassen-Ebene, wie schon `GET
   /content/preview/:token` – Modul-Typen sind nicht-sensible Metadaten,
   vergleichbar mit einer öffentlichen Komponenten-Bibliothek),
   `getModuleTypes()` nutzt jetzt `publicApiFetch()`.

Nebenbei behoben, weil im selben Screenshot sichtbar: `data.title` wurde
zusätzlich zur bereits oben gezeigten `<h1>{content.title}</h1>` ein
zweites Mal als eigenes Feld gerendert (viele Content-Types legen ein
paralleles `title`-Feld in `data` an) – die Vorschau-Seite überspringt
`field === "title"` jetzt explizit. Und: einfache String-/Richtext-Felder
(nicht nur Bausteine) nutzen jetzt ebenfalls `RichTextDisplay` statt
`<RichTextEditor editable={false} />` – Letzteres behält auch
schreibgeschützt einen sichtbaren Rahmen/Hintergrund
(`rounded-lg border border-input ...`), sieht dadurch wie ein
deaktiviertes Formularfeld statt wie echter Seiteninhalt aus. Neue,
gemeinsame Komponente `rich-text-display.tsx`: reines
`dangerouslySetInnerHTML` mit derselben Typografie wie der Editor, aber
ohne jede Rahmen-Chrome – wird jetzt sowohl von `BlockFieldOutput` als
auch direkt von der Vorschau-Seite für Nicht-Baustein-Felder verwendet.

## Bild-Baustein: Größe per Ziehen, Ausrichtung, Ersetzen

Bewusste, einzige Ausnahme von "Fläche ist rein lesend, alles läuft über
das Popup" (siehe oben): der Bild-Baustein ist auf ausdrücklichen
Nutzerwunsch direkt auf der Fläche interaktiv, analog zu Gutenbergs
Bild-Block-Toolbar (Nutzer-Screenshot als Vorbild).

- **Wertmodell erweitert**: `imageUrl`-Felder (`type: "image"`) sind
  nicht mehr nur ein URL-String, sondern optional ein Objekt `{url,
  width?, align?}` (`ImageFieldValue` in `block-field-output.tsx`).
  `toImageValue()` liest beide Formen ein (alte reine String-Werte
  bleiben abwärtskompatibel gültig, `width`/`align` sind dann einfach
  `undefined`/`"none"`) – **muss** überall verwendet werden, wo ein
  `"image"`-Feld gelesen wird (`BlockFieldOutput`, `ModuleFieldInput`,
  `EditableImageField`), sonst bricht die Anzeige für bereits
  vergrößerte/ausgerichtete Bilder.
- **Größe per Ziehen**: `EditableImageField` (nur im Editor, ersetzt
  `BlockFieldOutput` gezielt für `field.type === "image"`) zeigt einen
  kleinen Greif-Punkt unten rechts am Bild (`onPointerDown` + globale
  `pointermove`/`pointerup`-Listener, kein HTML5-DnD). Berechnet die
  neue Breite als Prozentsatz der Spaltenbreite (`wrapperRef.current
  .parentElement`), begrenzt auf 15–100 %. **Wichtig:** der Griff hat
  explizit `draggable={false}`, sonst würde die native Block-Drag&Drop-
  Verschiebung (der ganze Block ist `draggable`, siehe oben) die
  Zieh-Geste kapern statt der Resize-Logik – dasselbe gilt für den
  Ausrichtungs-Button/das Bild selbst innerhalb des Blocks.
- **Ausrichtungs-Menü + Ersetzen sitzen in der normalen Block-Toolbar**,
  nicht in einer eigenen, am Bild hängenden Leiste. Erste Umsetzung
  hatte eine zweite, eigenständige Hover-Leiste direkt am Bild
  (`group/image`, unabhängig vom äußeren `group` des Blocks) – dadurch
  überlappten sich zwei separate Overlays sichtbar (Screenshot-Beleg),
  sobald das Bild nah am oberen Blockrand saß. Korrektur: `imageField`
  wird im Block-Loop einmal bestimmt (erstes Content-Feld vom Typ
  `"image"`), Ausrichtung (`DropdownMenu`, 5 Optionen: Keine, Volle
  Breite, Linksbündig, Zentrieren, Rechtsbündig) und der
  Ersetzen-Button werden bedingt in die **eine** bestehende
  Block-Toolbar eingefügt (zwischen Modul-Name und Bearbeiten-Button).
  Gutenbergs Vorbild-Screenshot zeigt zusätzlich "Erweiterte Breite" als
  eigene Stufe zwischen "Keine" und "Volle Breite" – bewusst **nicht**
  übernommen: unser Design-Canvas hat (anders als ein echtes
  WordPress-Theme) nur eine einzige definierte Inhaltsbreite, "wide" und
  "full" wären bei uns pixelgleich und damit ein verwirrender
  Doppel-Eintrag ohne echten Unterschied. "Ersetzen" öffnet die
  bestehende `ImagePickerDialog` (derselbe Dialog wie im
  Bearbeiten-Popup), behält dabei `width`/`align` bei und ersetzt nur
  `url` (nicht das ganze Objekt), sonst würde ein bereits skaliertes
  Bild beim Austauschen auf 100 % zurückspringen. Ohne gesetztes Bild
  zeigt der gleiche Button stattdessen "Bild wählen".
- `EditableImageField` rendert **nur noch** das Bild + den Zieh-Griff
  (keine eigene Toolbar mehr), Sichtbarkeit des Griffs hängt jetzt am
  äußeren `group` des Blocks (derselbe Hover-Zustand wie die
  Block-Toolbar) statt an einem eigenen, verschachtelten Scope.
- **Bearbeiten löst jetzt ausschließlich der Stift-Button aus** – der
  ganze Block hatte vorher zusätzlich ein eigenes `onClick`, das bei
  jedem Klick auf den Block das Popup öffnete (mit `stopPropagation()`
  an einzelnen Kindelementen wie dem Bild "geschützt"). Das reichte
  nicht aus: `stopPropagation()` auf `pointerdown` verhindert nur die
  Bubbling-Kette **dieses** Events, verhindert aber nicht das
  nachfolgende, separate `click`-Event, das der Browser nach einem
  Maus-Runter-Rauf-Zyklus ohnehin auslöst – nach jedem Zieh-Vorgang am
  Resize-Griff öffnete sich dadurch trotzdem ungewollt das
  Bearbeiten-Popup. Fix: `onClick` auf dem Block-Wrapper komplett
  entfernt, `cursor-pointer` → `cursor-grab` (der Block ist ja weiterhin
  zum Umsortieren `draggable`). Einzige verbleibende Möglichkeit, das
  Popup zu öffnen, ist der Stift-Button in der Toolbar – dadurch fällt
  die ganze Klasse von "Klick auf X löst versehentlich Bearbeiten aus"-
  Bugs (Bild, Resize-Griff, zukünftige interaktive Feldtypen) grundsätzlich
  weg, statt sie einzeln per `stopPropagation()` zu flicken.
- **Links-/Rechtsbündig lässt Text umbrechen statt in eigener Zeile
  darunter zu stehen** ("wenn das Bild linksbündig oder rechtsbündig ist,
  soll der Text dann links oder rechts sein"): Ausrichtung `left`/`right`
  rendert das Bild jetzt mit echtem CSS `float-left`/`float-right`
  (`mr-4 mb-2` bzw. `ml-4 mb-2`) statt wie zuvor mit `flex justify-*`.
  `center` bleibt bei `mx-auto` (kein Float nötig/sinnvoll, kein
  Nebentext, der drumherum fließen könnte). Zwei Voraussetzungen, ohne
  die Floats nicht funktionieren:
  1. Der Felder-Container eines Blocks darf **kein** `flex flex-col`
     mehr sein (Flex-Kinder ignorieren `float` komplett) – jetzt
     `flow-root space-y-3` (in `block-editor-field.tsx` **und**
     `preview/[token]/page.tsx`, beide unabhängig, gleiche Änderung
     nötig). `flow-root` erzeugt zusätzlich einen eigenen Block-
     Formatierungskontext, der das Float **innerhalb** des jeweiligen
     Blocks einfängt (Höhe kollabiert sonst) und verhindert, dass es in
     nachfolgende Blöcke "ausläuft" – das moderne Äquivalent zum alten
     Clearfix-Hack.
  2. Die `width`/`align`-Darstellung sitzt weiterhin in der
     **gemeinsamen** `BlockFieldOutput`-Komponente (plus einer
     entsprechenden Anpassung in `EditableImageField` für den Editor,
     der das Bild selbst rendert statt `BlockFieldOutput` zu nutzen,
     siehe oben) – Editor-Vorschau und öffentliche Seite fließen dadurch
     identisch.

## Block-Level-Layout: auch Nicht-Bild-Bausteine ziehbar/positionierbar

Nutzerwunsch: *"zitat auch in der breite ziehbar. so das es bei einem
bild das links oder rechtsbündig ist, entsprechend sich positioniert,
wenn nicht in voller breite"* – Zitat (und generell jeder Baustein ohne
eigenes Bild-Feld) soll sich ebenfalls per Zieh-Griff verkleinern lassen
und dann neben einem links-/rechtsbündigen Bild-Block einreihen, nicht
nur *innerhalb* eines "Bild + Text"-Bausteins (das bereits vorhandene,
andere Feature).

**Neues Konzept: `instance.layout`** (`{width?, align?}`, exportiert als
`BlockLayoutValue` in `block-field-output.tsx`) – Breite/Ausrichtung des
**gesamten Blocks**, nicht eines einzelnen Feldwerts. `resolveBlockLayout
(contentFields, values, layout)` bestimmt für jeden Block einheitlich,
was seine tatsächliche Größe/Ausrichtung bestimmt, mit klarer Priorität:

1. Modul mit Bild-Feld **plus** weiteren Feldern (z.B. "Bild + Text") →
   Block bleibt immer 100 % breit; das interne Bild-Float+Text-Wrap
   (siehe oben) bleibt unverändert die einzige Positionierungslogik hier.
2. Modul mit **genau einem** Bild-Feld (z.B. "Bild") → die Blockgröße
   *ist* die im Bild-Feld gespeicherte Größe (`toImageValue`) – kein
   separates `layout` nötig, bestehende Toolbar-Bedienung (Ausrichtung +
   Ersetzen am Bild) bleibt unverändert die Eingabe dafür.
3. Alle anderen Module (Rich-Text, CTA-Button, Zitat, …) → `instance
   .layout`, bedient über einen **neuen** Zieh-Griff an der unteren
   rechten Ecke des Blocks selbst (nicht an einem Feld) und ein
   Ausrichtungs-Menü in der Block-Toolbar (`hasBlockLayoutControls =
   !imageField`).

**Wichtiger, tatsächlich aufgetretener Bug beim Bauen:** Fall 2 (Bild
allein) liest Größe/Ausrichtung aus demselben Feldwert, den auch
`EditableImageField`/`BlockFieldOutput` für die **eigene** Darstellung
des Bildes verwenden – wird beides ungeprüft kombiniert, wird die Breite
**doppelt angewendet** (z.B. 40 % eines bereits auf 40 % geschrumpften
Elternteils = sichtbar nur 16 %). Fix: beide Komponenten bekamen einen
`applyOwnLayout`-Schalter (Default `true`). Für Fall 2 wird er explizit
auf `false` gesetzt (`contentFields.length > 1` als Bedingung, an beiden
Aufrufstellen – Editor **und** öffentliche Vorschau, unabhängig
vergessen-bar) – die innere Bild-Darstellung wird dann nur noch `w-full`
(100 % ihres bereits korrekt verkleinerten Elternteils), Größe/Position
kommen ausschließlich vom äußeren Block-Wrapper. Der Bug wurde zunächst
nur im Editor gefixt und in der öffentlichen Vorschau übersehen (zwei
unabhängige Aufrufstellen derselben Komponente) – beim Live-Test mit
`grep`-Zählung der `width:`-Vorkommen aufgefallen (2× statt 1×) und
nachträglich auch dort korrigiert.

**Ein gemeinsamer `columnRef`** (auf die stabile Canvas-Spalte, einmal
pro `BlockEditorField`) statt eines Refs pro Block/Feld für alle
Zieh-Größenänderungen – ein bereits verkleinerter Block würde sonst
seine eigene (falsche, weil schon geschrumpfte) Breite als 100 %-Basis
für weiteres Ziehen nehmen. `EditableImageField` behält aus Zeitgründen
weiterhin seine eigene, lokale Referenz (funktioniert dort weiterhin
korrekt, weil sein unmittelbarer Elternteil bei Fall 1 nie selbst
schrumpft) – nur der neue Block-Resize-Griff (Fall 3) nutzt `columnRef`.

**Bekannte, bewusst akzeptierte Einschränkung:** die dünnen `DropZone`-
Trennstriche zwischen zwei Blöcken clearen Floats nicht explizit – bei
zwei nebeneinander schwimmenden Blöcken kann die Drop-Zone dazwischen
optisch in die verbleibende Restfläche neben dem Float rutschen statt
über die volle Breite zu reichen. Funktional bleibt sie trotzdem
nutzbar (Ablegen funktioniert), nur die Trefferfläche wirkt an dieser
Stelle schmaler. Absichtlich nicht behoben, um die sonst nötige
Umstrukturierung auf ein Flexbox-Zeilen-Gruppierungssystem zu vermeiden
– hätte deutlich mehr Risiko für das bereits gut funktionierende
Drag&Drop-Umsortieren bedeutet, für einen rein kosmetischen Rand.

## Sechs verworfene Vorläufer

**1. Listen-UI** (erste Umsetzung, 2026-08-07 vormittags): sortierbare
Liste mit „Baustein hinzufügen“-Dropdown, Reihenfolge per Drag&Drop,
Bearbeitung durch Aufklappen der Zeile. Noch am selben Tag verworfen:
*"gehe weg von dem bisherigen mit dem editor. ich möchte eine seite bauen
können über drag and drop [...] so wie auf einer weissen wand, und da
ziehe ich elemente rein. die typen sollen rechts neben der fläche stehen
[...] dann zieht man es hin, wo man möchte"*.

**2. Freiflächiges Canvas**: `ModuleInstance` bekam `x`/`y`-
Pixelkoordinaten, Bausteine wurden per Drag&Drop aus einer Typ-Palette
rechts frei auf eine feste 1200px breite Fläche gezogen, Bearbeitung per
Klick in einem Popup. Ebenfalls noch am selben Tag verworfen, mit
explizitem Verweis auf WordPress Gutenberg als Vorbild und *"kein body
oben mit dem editor brauch ich nicht"* – also zurück zu einer festen,
vertikalen Blockreihenfolge (keine x/y-Werte mehr) **und** Wegfall des
bis dahin parallel existierenden separaten `body`-Richtext-Felds im
"Seite"-Content-Type (siehe unten).

**3. Gutenberg-Flow mit Dropdown-Inserter**: feste Blockreihenfolge,
Inline-Bearbeitung – inhaltlich schon richtig, aber die Modul-Typen waren
hinter einem kleinen "+"-Dropdown-Menü zwischen den Blöcken versteckt,
keine permanent sichtbare Palette. Erneut noch am selben Tag korrigiert,
mit Screenshot des echten Gutenberg-Editors als Referenz: *"man soll die
elemente sofort sehen. das ist nicht das drag and drop, wie ich es
beschrieben habe [...] ich will erstmal nur die designerfläche sehen. das
soll in nem tab sein"*. Daraus wurden zwei konkrete Korrekturen: (a) die
Typ-Palette aus Vorläufer 2 kehrt zurück, aber jetzt links neben dem
Block-Flow statt in einem Popup-Menü versteckt, mit Drag&Drop auf
Zwischen-Positionen; (b) der Block-Editor bekommt einen eigenen "Design"-
Tab, der beim Öffnen sofort aktiv ist, statt mit den übrigen
Content-Feldern vermischt zu sein.

**4. Sichtbare Palette, aber Inhalt weiterhin als Formularfelder**:
Palette und "Design"-Tab waren jetzt korrekt, aber jedes Feld eines
Blocks (auch "echte" Inhaltsfelder wie das Button-Label oder das Zitat)
wurde weiterhin als beschriftetes `<Label>` + `<Input>`/`<Textarea>`
gerendert – strukturell identisch zu einem normalen Options-Formular,
nur eben inline statt in einer Liste. Erneut noch am selben Tag korrigiert,
wieder mit Gutenberg-Screenshot als Referenz (diesmal die eigentliche
Block-Fläche, nicht die Palette): *"und wo kann ich das jetzt verschieben
und schon wieder ist es im content kein echter inhalt, sondern wieder
optionsfelder. ich will im inhalt nur den echten content sehen [...]
optionen nur als popup. nicht im content selber. da soll nur die
ausgabe, wie es im frontend aussieht sein"*. Daraus entstand die
Trennung in `option`/`variant`/`example`-Feldeigenschaften und eine erste
`InlineContentField`-Komponente – kein Label mehr über den
Content-Feldern, echte Werte **inline** direkt anklickbar/editierbar,
Alt-Text/URL in ein separates Optionen-Popup verschoben. Inhaltsfelder
blieben dabei aber weiterhin **direkt auf der Fläche editierbar**
(Inputs/Textareas ohne Label, aber immer noch Inputs).

**5. Inline editierbar, aber nicht rein genug – und Klick-Fallback zum
Einfügen**: Die Palette-Kacheln hatten weiterhin ein `onClick`, das einen
Baustein ans Ende anhängte (Fallback neben Drag&Drop), und leere
Bausteine starteten mit `values: {}` (z.B. eine leere "Bild
auswählen"-Fläche statt eines Bildes). Erneut noch am selben Tag korrigiert,
in Großbuchstaben und mit zwei neuen Screenshots (leerer Bild-Baustein,
Leerzustand-Text "...ziehen oder anklicken"): *"ES MUSS ALLES PER DRAG
AND DROP SEIN. ich will die module reinziehen. nicht anklicken und sie
erscheinen da [...] alle bausteine sollen mit dummy daten also
beispieldaten befüllt sein. ein dummybild bei bild baustein ein lorem
ipsum text bei text und so weiter. bearbeiten mit popupfenster. soll
immer den inhalt zeigen, wie es wirklich aussieht"*. Drei Korrekturen:
(a) `onClick` auf den Paletten-Kacheln entfernt – Einfügen geht
ausschließlich per Drag&Drop; (b) `exampleValues()` befüllt jetzt *jeden*
Feldtyp inkl. Bild (eingebettetes Dummy-Bild) mit realistischem
Platzhalter, nicht nur Text; (c) `InlineContentField` wurde zu
`BlockPreview` (später weiter zu `BlockFieldOutput` extrahiert, siehe
Bug-Abschnitt oben) – die Fläche ist jetzt **komplett schreibgeschützt**,
jegliche Bearbeitung (Inhalt *und* Optionen zusammen, nicht mehr
getrennt) passiert in einem einzigen Bearbeiten-Popup, das per Klick auf
den Block oder einen Stift-Button geöffnet wird.

**6. Permanentes Icon/Name-Label + Pfeile statt Drag&Drop zum
Umsortieren**: Die Fläche war jetzt schreibgeschützt und zeigte
Beispielinhalte, aber jeder Block hatte weiterhin dauerhaft eine
Kopfzeile mit Icon+Name (z.B. "RICH-TEXT", "BILD") über dem Inhalt, und
Umsortieren lief über Auf/Ab-Pfeile statt Drag&Drop. Screenshot-Vergleich
mit der eigenen öffentlichen Vorschau-Seite als Referenz: *"der Designer
sieht immer noch nicht wie die Vorschau aus. das soll exakt so aussehen.
erst beim hovern soll eine bar mit optionen eingeblendet werden, wo man
dann z.b. bearbeiten und entfernen klicken kann. das verschieben muss
auch im content per drag and drop passieren. keine pfeile"*. Fix: die
Icon/Name-Kopfzeile ist komplett weg (kein `uppercase`-Label mehr
irgendwo im Editor); stattdessen eine schwebende, nur bei Hover/Fokus
sichtbare Leiste (`absolute -top-3`, überlappt die Blockkante) mit
Greif-Symbol, Icon+Name, Bearbeiten, Entfernen. Jeder Block ist jetzt
selbst `draggable`, `DropZone` unterscheidet über ein Payload-Präfix
(`new:`/`move:`) zwischen Einfügen aus der Palette und Umsortieren eines
bestehenden Blocks; die Auf/Ab-Pfeile sind ersatzlos entfernt.

Lehre: Bei "Baustein/Modul-System"-Anfragen ohne konkretes Vorbild zuerst
klären (oder ein bekanntes Referenzprodukt/einen Screenshot erfragen), ob
eine geordnete Liste, freie Positionierung oder ein Flow-Editor wie
Gutenberg gemeint ist – **und selbst mit genanntem Vorbild** jede
einzelne UI-Ebene genau genug nachbauen: sichtbare vs. versteckte
Palette, "Formularfeld mit Label" vs. "echt aussehender Inhalt", "inline
editierbar" vs. "nur Vorschau, Bearbeitung im Popup", **und**
"permanente Editor-Chrome" vs. "nur bei Hover eingeblendete Steuerung"
sowie "Pfeile" vs. "Drag&Drop" zum Umsortieren sind fünf unabhängige,
alle leicht übersehene Unterschiede zum Vorbild – "sieht aus wie
Gutenberg" heißt eben auch: die Design-Fläche selbst zeigt **nur** das,
was später auf der echten Seite zu sehen wäre, jede Editor-Bedienung ist
temporär/on-demand statt dauerhaft sichtbar. Ein Klick-Fallback neben
Drag&Drop wirkt hilfreich, wird aber als Bruch der expliziten Anforderung
("nur Drag&Drop") wahrgenommen, wenn genau das der Punkt der Anfrage
war – im Zweifel keine automatischen Komfort-Fallbacks ergänzen, die
nicht verlangt wurden. Die Datenmodelle/UI-Strukturen der einzelnen
Anläufe sind inkompatibel, jede Umstellung ersetzt State/Interface eher
als sie zu erweitern.

## "Seite"-Content-Type: `body`-Feld entfernt

Ursprünglich hatte "Seite" sowohl ein `body`-Richtext-Feld als auch das
`blocks`-Modul-Feld parallel. Mit dem Wechsel zum Gutenberg-Modell ist
`body` ersatzlos entfernt worden (Block-Editor ersetzt es vollständig,
kein zusätzliches Editor-Feld mehr nötig). Da `ContentType.schema` per
Seed nur bei Neuanlage geschrieben wird (`upsert` mit `update: {}`),
musste das Schema des bereits existierenden "Seite"-Eintrags in der
Dev-DB zusätzlich per direktem `prisma.contentType.update()` nachgezogen
werden – reines Bearbeiten von `seed.ts` reicht bei bereits gesäten
Datensätzen nicht aus (gleiches Muster wie beim ursprünglichen Anlegen
der Modul-Bibliothek).

## Icons

`ModuleType.icon` ist ein lucide-react-Icon-Name als String (z.B.
`"FileText"`, `"Image"`, `"Columns2"`), keine hochgeladene Bilddatei. Die
Zuordnung String → Komponente passiert über eine feste Lookup-Tabelle in
`block-editor-field.tsx` (`ICONS`), mit `Component` (generisches
Baustein-Icon) als Fallback für unbekannte/leere Werte. **Bei jedem neuen,
per Seed angelegten `ModuleType` das gewählte `icon`-Symbol auch hier
ergänzen** – sonst zeigt die Baustein-Palette nur das generische
Fallback-Icon (passiert bei der Einführung des "Formular"-Bausteins
(`icon: "ClipboardList"`, siehe [forms.md](./forms.md)) zunächst genau
so, erst beim Review aufgefallen).

## Tests

`apps/api/test/module-types.e2e-spec.ts`: Auth-Gate der beiden
Read-Endpoints, 404 für unbekannte Id, und ein Round-Trip-Test, der
Content mit mehreren geordneten Modul-Instanzen anlegt und prüft, dass
`data.blocks` (Reihenfolge + Werte) unverändert zurückkommt.

## Update 2026-09-03: Ausrichtung für JEDEN Baustein

**Nutzervorgabe:** *„auf jeden Block soll die Ausrichtung gesetzt werden.
so dass ich überall Vollbild usw. anwenden kann. aktuell bei Cover nicht
vorhanden. und bei Kacheln Drag and Drop Größe hinzufügen und auch
Ausrichtung."*

### Warum Cover und Kacheln vorher keine hatten

`resolveBlockLayout()` gab für jeden Baustein mit Bild UND weiteren
Feldern fest `none`/100 zurück. Die Regel stammt vom „Bild + Text"-Fall:
dort richtet sich das BILD innerhalb des Blocks aus (Float neben dem
Text), der Block selbst bleibt neutral. Cover und Kacheln fielen unter
dieselbe Regel, obwohl ihr Bild gar nicht fließt – es liegt vollflächig
dahinter bzw. im Raster. Sie waren damit die einzigen Bausteine ganz ohne
Ausrichtung.

Jetzt liest dieser Zweig `layout` wie alle anderen. `hasIntraBlockImage`
bleibt erhalten – das Bild richtet sich weiterhin im Block aus –, aber der
Block bekommt zusätzlich seine eigene Ausrichtung. **Rückwärtskompatibel:**
bestehende Blöcke haben kein `layout`, das ergibt weiter `none`/100.

Im Editor hängen Ausrichtungs-Menü und Zieh-Griff am selben Schalter,
Kacheln und Cover haben damit beides. Ausgenommen bleibt nur der reine
Bild-Baustein (Bild ohne weitere Felder): dort stünden zwei
Ausrichtungs-Menüs nebeneinander und meinten dasselbe.

### Ersetzen in der Kachel

*„bei Kachel ist Ersetzen oben in der Ecke, soll vollflächig in der Kachel
sein"* – umgesetzt. Der frühere Eck-Knopf war eine Notlösung aus der Zeit,
als ein Baustein noch am Körper gezogen wurde und ein `inset-0`-Overlay
keine Greiffläche übrig ließ. Gezogen wird längst am eigenen Griff, damit
ist der Grund entfallen; die Bedienung entspricht jetzt den übrigen
Bildern.

Geprüft: ein „Bild + Text"-Baustein mit `layout.align: "bleed"` trägt auf
der Website die Ausbruch-Klassen – vorher war das an dieser Stelle
unmöglich.
