# Pflichtfeld-Sterne (`*`)

**Datum:** 2026-08-19
**Betroffene Bereiche:** apps/web (`components/ui/label.tsx`,
`components/ui/form.tsx`, ~20 Dialog-/Formular-Komponenten)

## Was wurde gebaut

Nutzervorgabe: "Alle Pflichtfelder beim Namen mit * markieren überall
im Projekt." Zentraler Baustein statt 20 Einzel-Umsetzungen:
`Label` (`ui/label.tsx`) bekam ein neues optionales `required`-Prop,
das einen roten Stern (`<span className="text-destructive">*</span>`)
nach dem Label-Text rendert. `FormLabel` (`ui/form.tsx`, react-hook-
form-Wrapper um `Label`) reicht `required` einfach durch – ihr
TS-Typ musste dafür erst um `{ required?: boolean }` erweitert werden
(spreadete `required` vorher schon zur Laufzeit korrekt durch, war nur
nicht typisiert).

Anschließend jedes Formular im Projekt einzeln geprüft – **nicht** nach
Label-Text geraten ("Name" klingt nach Pflicht"), sondern anhand der
tatsächlichen Validierung (blockiert Speichern bei leerem Feld? Native
`required` am Input? Zod-Schema ohne `.optional()`? Backend-DTO ohne
`@IsOptional()`?). ~20 Dateien mit echten Pflichtfeldern markiert:
Löschanfrage (Name/E-Mail), Standort (Name), Auftragsverarbeiter
(Name), Datenschutzvorfall (Titel), Verarbeitungstätigkeit (Zweck),
Kategorien/Tags (Name/Slug), Rolle (Name), Content-Editor (Content-Type/
Titel/Slug/Veröffentlichungszeitpunkt bei geplanter Seite), Ordner
(Name), Menü (Name/Slug), Menüpunkt (Label/Externe URL), Webhook
(Ziel-URL + die Checkbox-Gruppe "Events"), FAQ-Gruppe (Name), FAQ-Frage
(Frage/Antwort), Galerie (Name), globaler Baustein (Name), geteilter
Block (Name), Auskunft erstellen (Person), 2FA (Bestätigungscode,
Passwort bestätigen beim Deaktivieren).

Im selben Zug zwei bereits bestehende, manuell gebaute Stern-Anzeigen
(`content-editor-form.tsx` dynamische Content-Type-Felder,
`module-field-input.tsx` Baustein-Felder – beide `{field.required &&
<span className="text-destructive"> *</span>}`) auf das neue
`required`-Prop vereinheitlicht, statt zwei Implementierungen desselben
visuellen Musters parallel zu pflegen.

## Bewusst NICHT markiert

- **Datei-Upload-Felder** (Medien-Bibliothek, Video/Bild/Datei-Picker,
  Avatar/Logo-Upload): sind technisch Pflichtfelder (Speichern
  blockiert ohne Datei), aber ein `*` neben einer Datei-Auswahl wäre
  irreführend/unüblich – ausgenommen wie bei Checkboxen/Switches.
- **Firma-Seite** (12 Stammdaten-Felder), **Datenschutzbeauftragter-
  Kontaktfelder**: alle Backend-seitig `@IsOptional()`, kein
  Client-Check – speisen nur die "Vollständigkeit"-Anzeige, blockieren
  nichts. Ein `*` hätte hier gelogen.
- **`nav-item-content`** (Menüpunkt-Dialog, Feld "Inhalt" wenn
  Ziel-Typ = Content): logisch eigentlich Pflicht (ein Menüpunkt ohne
  gewählten Inhalt ergibt keinen Sinn), aber **aktuell nicht
  validiert** – Speichern lässt ein leeres Feld durch. Bewusst nicht
  markiert, weil ein Stern ohne echte Validierung dahinter eine falsche
  Zusage wäre. Separater, kleiner Bug – braucht eine echte
  Validierungs-Ergänzung, nicht nur den Marker, falls das gewünscht ist.
- **`dr-user`** (Löschanfrage-Dialog, "Bestehende Person wählen
  (optional)"): ist im eigenen Label-Text schon explizit als optional
  gekennzeichnet.

## Warum diese Lösung

Ein zentrales `required`-Prop auf `Label`/`FormLabel` statt 20×
`{field} <span className="text-destructive">*</span>` von Hand –
garantiert dieselbe Farbe/denselben Abstand überall (siehe
[toast-and-system-messages.md](./toast-and-system-messages.md)s
"SystemMessage-Farben sind kanonisch"-Prinzip, hier auf Pflichtfeld-
Sterne übertragen) und macht künftige neue Pflichtfelder zu einer
Ein-Wort-Änderung (`required` auf den Label-Call setzen) statt
copy-paste-anfälligem Markup.

## Relevante Dateien

- `apps/web/src/components/ui/label.tsx` (`required`-Prop, neu)
- `apps/web/src/components/ui/form.tsx` (`FormLabel`-Typ erweitert)
- `apps/web/src/components/content-editor-form.tsx`,
  `module-field-input.tsx` (bestehende manuelle Sterne vereinheitlicht)
- ~18 weitere Dialog-Komponenten (siehe Liste oben) mit `required` auf
  dem jeweiligen `Label`/`FormLabel`-Call
