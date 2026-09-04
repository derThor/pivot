# Template-Manifest: Frontend-Einstellungen ohne Code in der Verwaltung

**Stand:** 2026-09-05, Stufe 1 (Einstellungen) umgesetzt, Stufe 2
(Bereiche) geplant.

## Das Problem

Die Verwaltung ist für alle Installationen dieselbe, das Frontend-Template
ist pro Projekt ein anderes (siehe die Regel in
[display-tab-appearance.md](./display-tab-appearance.md): *"backend ist
immer pivot. frontend ist individuell"*). Trotzdem standen die
Gestaltungswerte des Templates – Inhaltsbreite, Farben, Verhalten des
Kopfbereichs – als feste Hex-Werte in `apps/site/src/app/globals.css`, und
jede neue Einstellung hätte eine neue Spalte plus Formularfeld in
`apps/web` gebraucht. Für ein zweites Projekt mit anderen Werten wäre das
nicht aufgegangen.

Nutzervorgabe dazu (2026-09-05): *"ich möchte eine komplett individuelle
mechanik, mit der ich individuell für jedes template eigene bedingungen
anlegen kann. ich möchte nichts starres bauen, das nur für pivot geht.
beim frontend muss das für jedes template, egal wie es aussieht, gehen."*

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

| Datei | Rolle |
| --- | --- |
| `packages/blocks/src/template-manifest.ts` | Das Vokabular: Feldtypen, Bereichsform, `resolveTemplateSettings()`, `templateCssVars()`. Von beiden Apps benutzt. |
| `apps/site/src/template/manifest.ts` | **Projekteigen.** Was DIESES Template hat. |
| `apps/site/src/app/api/template/route.ts` | Gibt das Manifest als JSON aus (`force-static`). |
| `apps/web/src/components/template-settings-fields.tsx` | Der generische Renderer unter Einstellungen → Frontend → Darstellung. |

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
- **Die Akzentfarbe steht bewusst NICHT im Manifest.** Sie ist eine eigene
  Einstellung (`AppSettings.accentColor`) und gäbe es sonst zweimal. Im
  Layout wird sie zuletzt gesetzt und sticht damit einen gleichnamigen
  Template-Wert.
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
