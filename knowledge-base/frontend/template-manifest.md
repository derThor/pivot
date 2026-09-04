# Template-Manifest: Frontend-Einstellungen ohne Code in der Verwaltung

**Stand:** 2026-09-05 – Stufe 1 (Einstellungen) und der Mechanismus von
Stufe 2 (Bereiche) sind umgesetzt; die Bausteine für Kopf/Fuß fehlen noch,
siehe unten.

## Das Problem

Die Verwaltung ist für alle Installationen dieselbe, das Frontend-Template
ist pro Projekt ein anderes (siehe die Regel in
[display-tab-appearance.md](./display-tab-appearance.md): _"backend ist
immer pivot. frontend ist individuell"_). Trotzdem standen die
Gestaltungswerte des Templates – Inhaltsbreite, Farben, Verhalten des
Kopfbereichs – als feste Hex-Werte in `apps/site/src/app/globals.css`, und
jede neue Einstellung hätte eine neue Spalte plus Formularfeld in
`apps/web` gebraucht. Für ein zweites Projekt mit anderen Werten wäre das
nicht aufgegangen.

Nutzervorgabe dazu (2026-09-05): _"ich möchte eine komplett individuelle
mechanik, mit der ich individuell für jedes template eigene bedingungen
anlegen kann. ich möchte nichts starres bauen, das nur für pivot geht.
beim frontend muss das für jedes template, egal wie es aussieht, gehen."_

## Die Lösung: das Template beschreibt sich selbst

Dasselbe Muster, das der Seiten-Designer längst benutzt. Er kennt keinen
Baustein namentlich, sondern liest `ModuleType.schema` und rendert daraus
generisch ein Formular. Genauso kennt die Verwaltung kein Template
namentlich – sie liest dessen **Manifest**.

```
apps/site/src/template/manifest.ts     das Template beschreibt sich
        │                              (projekteigen, wie brand.ts)
        ▼
GET  {site}/api/template               als JSON, öffentlich
        │
        ▼
GET  /admin/api/template               die Verwaltung holt es sich
        │                              (resolveSiteBaseUrl, wie die Vorschau)
        ▼
TemplateSettingsFields                 zeichnet Felder nach TYP,
        │                              kennt kein Feld namentlich
        ▼
AppSettings.templateSettings (Json)    Werte, Schlüssel = manifest key
        │
        ▼
GET  /public/site  →  layout.tsx       CSS-Variablen auf <html>
```

## Die vier Dateien

| Datei                                                  | Rolle                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `packages/blocks/src/template-manifest.ts`             | Das Vokabular: Feldtypen, Bereichsform, `resolveTemplateSettings()`, `templateCssVars()`. Von beiden Apps benutzt. |
| `apps/site/src/template/manifest.ts`                   | **Projekteigen.** Was DIESES Template hat.                                                                         |
| `apps/site/src/app/api/template/route.ts`              | Gibt das Manifest als JSON aus (`force-static`).                                                                   |
| `apps/web/src/components/template-settings-fields.tsx` | Der generische Renderer unter Einstellungen → Frontend → Darstellung.                                              |

## Was starr ist – und warum es das sein muss

Die Liste der **Feldtypen** (`text`, `textarea`, `number`, `color`,
`select`, `boolean`, `image`, `navigation`, `spacing`). Die Verwaltung muss
wissen, wie sie ein Feld zeichnet; das ist der einzige gemeinsame Nenner.
Sie ist nicht Pivot-spezifisch, sondern das Vokabular, in dem sich alle
Templates ausdrücken. Braucht ein Template mehr, wird das Vokabular für
alle erweitert – eine bewusste Entscheidung statt eines Sonderfalls.

Genauso hat `ModuleType.schema` eine Handvoll Feldtypen und beliebig viele
Bausteine.

## Entscheidungen, die man kennen sollte

- **Manifest im Code, nicht in der Datenbank** (Nutzerentscheidung nach
  Rückfrage). Es liegt beim Template, wird mit ihm versioniert und kann
  nicht auseinanderlaufen. Preis: ein neues Feld braucht einen Deploy des
  Frontends. Die Alternative (pflegbar in der Verwaltung) hätte zwei
  Wahrheiten erzeugt – ein Feld, das existiert, aber vom Template nicht
  benutzt wird, und umgekehrt.
- **Eine Json-Spalte statt einer Spalte je Feld.** Welche Felder es gibt,
  weiß nur das Template. Preis: keine Typprüfung in der Datenbank; geprüft
  wird gegen das Manifest.
- **Unbekannte Schlüssel bleiben stehen.** Entfernt ein Template ein Feld
  (oder wird gewechselt), ist der Wert nicht verloren –
  `resolveTemplateSettings()` ignoriert ihn nur.
- **`cssVar` ist optional.** Farben und Größen landen automatisch als
  CSS-Variable auf `<html>`; alles andere (Schalter, Auswahl) liest das
  Template selbst aus `site.templateSettings` – so wie
  `headerSticky`/`headerStyle` im `SiteHeader`.
- **Die Akzentfarbe der Website steht im Manifest, die des Backends in den
  Einstellungen.** Getrennt, seit die Trennlinie gezogen wurde
  (Nutzervorgabe, 2026-09-05): _"alles aus Darstellung Backend darf sich
  nur aufs backend auswirken"_. `AppSettings.accentColor` wird deshalb gar
  nicht mehr an die Website ausgeliefert – das Feld ist aus
  `/public/site` entfernt. Im Manifest hängen die vier Akzent-Töne
  zusammen (Akzent, Hover, Schrift darauf, Linkfarbe): wer den Akzent auf
  ein dunkles Blau stellt, braucht auch eine helle Schrift darauf.
- **Kein Manifest ist kein Fehler.** Läuft die Website nicht oder bringt
  ein Template keins mit, antwortet die Verwaltungs-Route mit
  `{ manifest: null }` und die Oberfläche zeigt einen Hinweis. Der Rest
  der Einstellungen bleibt bedienbar.

## Was noch fehlt (Stufe 2)

Die **Bereiche** (`manifest.regions`) sind deklariert, aber noch nicht
befüllbar: Kopf- und Fußbereich sind weiterhin React-Code
(`site-header.tsx`, `site-footer.tsx`). Geplant ist, sie als
Baustein-Sammlungen zu speichern und mit demselben Designer zu bearbeiten
wie Seiten – dafür braucht es Bausteine für Logo, Menü und Knopf sowie
einen Rahmen, der das Verhalten behält (Kleben, Burger-Menü auf dem Handy,
Höhenmessung für `--header-height`). Der Rahmen bleibt Code: Bausteine
haben kein Verhalten.

## Beim Erweitern beachten

- `key` ist der Name in der Datenbank – stabil halten.
- Ein Feld ohne Wirkung ist ein Blindschalter. `headerSticky` und
  `headerStyle` wurden deshalb sofort im `SiteHeader` angeschlossen, nicht
  "später".
- Neue Feldtypen gehören ins Vokabular in `packages/blocks`, nicht in
  einen Sonderzweig im Renderer.

## Stufe 2: Bereiche mit Bausteinen füllen (2026-09-05)

Umgesetzt ist der Mechanismus, noch nicht die Bausteine, die einen
Kopfbereich wirklich brauchbar machen (Logo, Menü, Knopf – siehe „Was noch
fehlt“ unten).

### Der Weg eines Bereichs

```
manifest.regions[]              das Template sagt, welche es gibt
      │
      ▼
Inhalte → Bereiche              Liste links, Designer rechts
      │                         (regions-explorer.tsx)
      ▼
PUT /template-regions/:key      Bausteine als { blocks: [...] }
      │
      ▼
TemplateRegionContent (DB)      key @unique, data Json
      │
      ▼
GET /public/template-regions    öffentlich, wie die globalen Module
      │
      ▼
layout.tsx                      Bereich gefüllt → ersetzt die eingebaute
                                Fassung; leer → alles bleibt wie bisher
```

### Entscheidungen

- **Eigenes Modell statt `Content` mit eigenem Typ.** Eine Seite hat Slug,
  Status, Kategorien, SEO, Versionen und Papierkorb – für einen Bereich
  ist davon nichts sinnvoll. Preis: **keine Versionshistorie** für
  Bereiche. Bewusst, weil ein Bereich klein ist und selten geändert wird;
  wenn das drückt, ist es nachrüstbar.
- **Die API prüft NICHT gegen das Manifest.** Sie kennt es nicht (es lebt
  im Frontend) und verwahrt nur Bausteine unter einem Schlüssel. Ein
  Bereich, den das Manifest nicht mehr kennt, bleibt liegen statt gelöscht
  zu werden – wie bei den Einstellungen.
- **Leer heißt „eingebaute Fassung“.** Erst wenn Bausteine drin sind,
  übernimmt der Bereich. Dadurch ändert das Einführen der Mechanik an
  einer bestehenden Website exakt nichts, und ein versehentlich geleerter
  Bereich macht die Website nicht kopflos.
- **Der Rahmen bleibt Code.** `SiteHeader` behält Kleben, Weichzeichnen und
  die Höhenmessung (`--header-height`) und nimmt die Bausteine als
  `children`. Bausteine haben kein Verhalten – ein per Baustein gebautes
  Burger-Menü gibt es nicht.
- **Rechte:** `content:read` / `content:update`, kein eigenes Recht. Wer
  Seiten baut, gestaltet auch Kopf und Fuß (gleiche Überlegung wie bei der
  Palette-Reihenfolge). Ein eigenes Recht ließe sich später ergänzen, ohne
  dass sich an den Endpunkten etwas ändert.

### Was noch fehlt

1. ~~Bausteine für Kopf und Fuß~~ – Logo und Menü sind gebaut (siehe
   unten). Offen bleiben Footer-Menüspalte und Rechtstexte-Liste; ein
   Knopf existiert bereits als `cta-button`.
2. **Burger-Menü auf dem Handy** – gehört in den Rahmen, nicht in die
   Bausteine.
3. **Leitplanken**: Warnung, wenn ein `required`-Baustein fehlt (die
   Oberfläche zeigt den Hinweis, prüft aber nicht den Inhalt).

### Bausteine für Kopf und Fuß (2026-09-05, Nachtrag)

Zwei neue Bausteine und dafür zwei neue Feldtypen im Baustein-Schema –
nach demselben Muster wie der Formular-Baustein: das Feld speichert nur
einen Verweis, wie es AUSSIEHT weiß allein die Website und reicht eine
`render…`-Funktion herein.

| Baustein | Feld                          | Rendert                                                        |
| -------- | ----------------------------- | -------------------------------------------------------------- |
| Logo     | `logo` (Wert: `light`/`dark`) | Das Logo des Templates (`template/brand.ts`), verlinkt auf `/` |
| Menü     | `navigation` (Wert: Menü-Id)  | Die gewählte Navigation über `NavMenu`                         |

**Warum das Logo kein Bild-Feld ist:** das Logo gehört dem Template, nicht
dem Inhalt (siehe die Marken-Regel in
[display-tab-appearance.md](./display-tab-appearance.md)). Wäre es ein
Bild-Feld, würde jede Installation ihr Logo doppelt pflegen – einmal im
Template, einmal im Baustein. Gespeichert wird deshalb nur, für welchen
Grund es gedacht ist: Kopfbereich hell, Fußbereich dunkel.

**Neu für die Website:** `GET /public/navigations` liefert alle Menüs
aufgelöst. Der Baustein kennt nur eine Id, und welche Menüs auf einer
Seite vorkommen, weiß man erst beim Rendern – deshalb alle auf einmal
statt einer Abfrage je Baustein. Die Menüs sind ohnehin öffentlich
(Kopf-/Fußbereich geben sie aus).

**Nebenbei entdoppelt:** `NavLink` und die Menüleiste standen im
`SiteHeader`; mit dem Menü-Baustein wären sie ein zweites Mal nötig
gewesen. Beides liegt jetzt in `components/nav-menu.tsx`, der eingebaute
Kopfbereich benutzt dieselbe Komponente.

**Praxistest (2026-09-05):** Kopfbereich aus Logo (30% links) + Menü (70%
rechts) gebaut – die Website zeigte beides an Stelle der eingebauten
Fassung, inklusive Akzentknopf für den Menüpunkt mit `ACCENT_BUTTON`. Nach
dem Löschen des Bereichs war der eingebaute Kopf wieder da.
