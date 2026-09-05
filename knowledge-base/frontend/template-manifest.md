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

## Stufe 3: Templates als Paket hochladen (2026-09-05)

Nutzervorgabe: _"baue eine uploadfunktion, das man ein frontend-template
hinzufügen kann. das dies in einer liste auftaucht und man dieses
aktivieren und deaktivieren kann. das auch immer nur eins aktiv sein kann.
so das ich im livebetrieb einfach ein anderes template hochladen kann und
damit die gesamte seite anders aussehen lassen kann."_

### Was in einem Paket steckt – und warum nicht mehr

```
mein-template.zip
├ template.json     Name, Version, Manifest
├ theme.css         reines CSS
├ regions.json      (optional) Vorlagen für Kopf-/Fußbereich
└ assets/           Bilder und Schriften
```

CSS und Daten brauchen **keinen Build** – deshalb wirkt ein Wechsel
sofort, ohne Deploy. React-Komponenten müssten kompiliert werden und
können nie Teil eines Uploads sein. Ein Template ändert damit das
**Aussehen**, nicht Aufbau oder Verhalten: Farben, Typografie, Abstände,
Rundungen, Rasterspalten – aber nicht, dass ein Kachel-Baustein plötzlich
als Karussell rendert.

### Der Gestaltungs-Vertrag

Damit fremdes CSS zuverlässig greift, tragen die gemeinsamen Komponenten
stabile Klassen (`pv-header`, `pv-nav`, `pv-block`, `pv-footer` …, siehe
`packages/blocks/src/style-hooks.ts`). Für die **Bausteine ist die Liste
abgeleitet**, nicht gepflegt: jeder bekommt `pv-block-<slug>` aus seinem
Modul-Typ (Nutzerhinweis: _"das system kennt seine komponenten ja"_). Ein
neuer Baustein steht damit sofort im Katalog.

Die Klassen tragen **keine eigene Gestaltung** – sie sind reine Griffe,
damit ein Template sie ohne Spezifitäts-Kampf überschreiben kann.

### CSS-Prüfung beim Import

Erlaubt ist praktisch alles außer **Verweisen nach draußen**
(Nutzerentscheidung): kein `@import`, kein `url()` auf einen fremden
Server. Sonst meldete jeder Seitenaufruf sich bei Dritten – im CSS
versteckt und von außen nicht zu sehen. Schriften und Bilder kommen aus
`assets/`; ihre Pfade werden beim Import einmal auf
`/uploads/templates/<key>/…` umgeschrieben, nicht bei jedem Aufruf.

Geprüft wird auf Textebene statt mit einem CSS-Parser: die Regel ist
bewusst grob, im Zweifel abgelehnt. `assertSafeCss()` ist ohne Umgebung
testbar – das war der Grund, das Auspacken von Datenbank und Dateisystem
zu trennen.

### Werte liegen JE TEMPLATE

Beim ersten echten Test fiel auf: mit einem gemeinsamen Werte-Topf
gewinnen die gespeicherten Farben des vorigen Templates über die Vorgaben
des neuen, sobald beide denselben Schlüssel benutzen – ein hochgeladenes
dunkles Template blieb dadurch hell. `AppSettings.templateSettings` hält
die Werte deshalb nach Template getrennt (`{ "__builtin": {…},
"nachtblau": {…} }`, siehe `templateSettingsFor()`). Ein Zurückschalten
stellt die vorher gepflegten Werte wieder her.

Die alte, flache Form wird beim Lesen als Werte des eingebauten Templates
verstanden – daran erkennbar, dass die Werte keine Objekte sind.

### Rangfolge des Manifests

1. aktives hochgeladenes Template,
2. in den Einstellungen hinterlegtes Manifest,
3. die Datei des Frontend-Projekts.

Dieselbe Reihenfolge in `apps/site/src/app/layout.tsx` und in der
Verwaltungs-Route `/admin/api/template` – wer eine ändert, muss die andere
mitziehen.

### Kleinigkeiten mit Folgen

- Das **aktive Template lässt sich nicht löschen**. Sonst stünde die
  Webseite ohne Gestaltung da, ohne dass es jemand wollte.
- Ein erneuter Upload mit gleichem Schlüssel **ersetzt** das vorhandene
  und behält den Aktiv-Zustand – wer eine Korrektur seines laufenden
  Templates hochlädt, will sie sofort sehen.
- `/public/frontend-template` antwortet mit `{ template: null }` statt mit
  nacktem `null`: ein leerer Antwortkörper ist kein JSON, die Website lief
  damit in einen 500er (Fund beim Zurückschalten).
- **SVG ist als Asset nicht erlaubt.** Es kann Skript enthalten; die
  Medienbibliothek behandelt SVGs deshalb schon heute gesondert
  (Content-Disposition: attachment), was für eine Schrift oder ein
  CSS-Hintergrundbild nutzlos wäre.

### Praxistest (2026-09-05)

Paket „Nachtblau" (dunkler Grund, blauer Akzent, 1320px Bahn) gebaut,
importiert, aktiviert: die Website lieferte
`--color-background:#0b1020 … --content-width:1320px` und das eingehängte
`<style data-template="nachtblau">`. Nach dem Zurückschalten wieder
Pivots Werte. Die CSS-Prüfung lehnte `@import`, `https://…` und `//…`
zuverlässig ab und ließ `url("./assets/…")` durch.

### Manifeste in der Oberfläche bearbeiten (2026-09-05, Nachtrag)

Nutzervorgabe: _"bau das so um, das jedes manifest dynamisch bearbeitet
werden kann in der ui"_. Vorher gab es nur ein JSON-Textfeld, und nur für
das eingebaute Template.

Jetzt ein gemeinsamer Editor-Dialog (`template-manifest-dialog.tsx` +
`template-manifest-editor.tsx`) an zwei Stellen:

- **Eingebautes Template**: Einstellungen → Frontend → „Manifest
  bearbeiten“; gespeichert wird als Übersteuerung in den Einstellungen.
- **Jedes hochgeladene Template**: in der Liste der Knopf „Manifest“;
  gespeichert wird am Template selbst (`PATCH /frontend-templates/:id`).

Der Dialog weiß nicht, WOHIN gespeichert wird – das übergibt der Aufrufer
als `onSave`. Dadurch gibt es den Editor genau einmal.

**Zwei Ansichten auf dasselbe Objekt:** die Felder-Ansicht für den
Normalfall (Beschriftung, Gruppe, Typ, CSS-Variable, Vorgabewert; Felder
hinzufügen und entfernen) und die JSON-Ansicht für alles, was ein Formular
schlecht abbildet – Optionen einer Auswahl, `showIf`-Bedingungen,
Pflicht-Bausteine eines Bereichs. Ein Wechsel zwischen beiden verliert
nichts.

**Bereiche lassen sich umbenennen, aber nicht anlegen.** Ein Bereich
erscheint nur, wenn das Template ihn rendert – ihn hier zu erfinden würde
einen Eintrag erzeugen, der nirgends auftaucht.

Der Vorgabewert wird nach dem FELDTYP gelesen (Zahl → Zahl, Schalter →
Boolean): sonst stünde später ein String in einem Zahlenfeld, und die
Website rechnete damit.

### Nachgezogen am 2026-09-05 (Selbstprüfung)

Zwei Dinge waren nicht in Ordnung und sind behoben:

**Der Gestaltungs-Vertrag hat gelogen.** `pv-archive`, `pv-post` und
`pv-form` standen im Katalog, aber nicht im Markup – ein Template hätte
dagegen geschrieben und nichts wäre passiert. Ein Vertrag, der Klassen
verspricht, die es nicht gibt, ist schlimmer als keiner. Alle drei sind
jetzt gesetzt (Kategorie-Übersicht, Beitrag in der Blog-Darstellung,
Formular). **Prüfung beim Erweitern:** Katalog und Markup gegeneinander
abgleichen, etwa mit
`grep -o 'pv-[a-z-]*' apps/site/src packages/blocks/src`.

**`regions.json` wurde gespeichert, aber nie angewandt.** Ein Feld ohne
Wirkung – genau das, was dieses Projekt sonst vermeidet. Beim Aktivieren
werden die Vorlagen jetzt übernommen, aber **nur in leere Bereiche**: wer
seinen Kopfbereich eingerichtet hat, verliert ihn nicht, weil er ein
anderes Template ausprobiert. Die Antwort meldet zurück, welche Bereiche
vorbelegt wurden (`filledRegions`).

Geprüft mit einem zweiten Paket, dessen `regions.json` einen Fußbereich
mitbringt: nach dem Aktivieren stand der Vorlagen-Baustein auf der
Website; ein bereits gefüllter Bereich blieb unangetastet.
