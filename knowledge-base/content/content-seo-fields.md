# SEO-Felder pro Content-Eintrag

**Datum:** 2026-08-06
**Betroffene Bereiche:** apps/api (`src/content`), apps/web
(`src/components/content-editor-form.tsx`)

> **Update 2026-08-06 (Info-Tooltips, OG-Bild-Upload wie Logo-Feld):**
> - Neue wiederverwendbare `InfoTooltip`-Komponente
>   (`src/components/info-tooltip.tsx`, "i"-Icon + Hover-Text über die
>   bereits vorhandene `Tooltip`-UI-Komponente/`TooltipProvider`) – an
>   jedem Feld-Label im "Inhalt"-Tab (Content-Type, Slug, Status – Status
>   erklärt alle vier Werte in einem mehrzeiligen Tooltip) und im
>   "SEO"-Tab (alle Felder) ergänzt. Der bisherige statische Hinweistext
>   unter "SEO-Titel" wurde durch den Tooltip ersetzt statt doppelt
>   vorzuhalten.
> - **OG-Bild**: die bisherige "Bild wählen"-Schaltfläche (öffnete den
>   großen `ImagePickerDialog` zur Auswahl aus der Medienbibliothek)
>   durch denselben Direkt-Upload-Flow wie die Logo-Felder in den
>   Einstellungen ersetzt (`Input type="file"` + "Hochladen"-Button +
>   Papierkorb-Icon zum Entfernen), auf Nutzerwunsch ("so umsetzen wie
>   bei Einstellungen"). Bewusster Unterschied zu `LogoUploadField`:
>   "Entfernen" löscht hier **nur** die Referenz (`ogImageUrl` wird
>   geleert), nicht die zugrunde liegende Mediendatei – anders als beim
>   Logo (eigener geschützter System-Ordner) kann ein OG-Bild eine
>   beliebige, evtl. anderswo wiederverwendete Datei sein; ein Löschen
>   der Datei beim Entfernen der Referenz wäre hier zu aggressiv.
>   `ImagePickerDialog`-Import aus `content-editor-form.tsx` entfernt
>   (keine andere Stelle dort nutzt ihn mehr).

## Was wurde gebaut

- Sieben neue `Content`-Felder: `canonicalUrl`, `ogTitle`,
  `ogDescription`, `ogImageUrl`, `twitterCard`
  (`"summary" | "summary_large_image"`, nullable), `robotsIndex` /
  `robotsFollow` (beide `Boolean @default(true)`).
- **Wichtiger Fund dabei**: `excerpt`, `seoTitle`, `seoDescription`
  existierten bereits **im Schema und in den DTOs** seit dem
  ursprünglichen Content-Modell – aber nirgends im Frontend-Editor. Ein
  Redakteur konnte diese Werte also nie tatsächlich setzen, obwohl die
  Volltextsuche (`global-search.md`) sie bereits mitdurchsucht hat. Jetzt
  behoben, zusammen mit den neuen Feldern.
- Neuer "SEO"-Tab im Content-Editor (`content-editor-form.tsx`, neben
  dem bisherigen "Inhalt"-Tab): Excerpt, SEO-Titel, Meta-Description,
  Canonical-URL, Robots-Schalter (Index/Follow) in einer Karte;
  OpenGraph/Twitter-Card (OG-Titel, OG-Beschreibung, OG-Bild per
  wiederverwendetem `ImagePickerDialog`, Twitter-Card-Typ-Select) in
  einer zweiten Karte darunter.
- Diese Felder liegen wie die Firmenfelder in `settings-form.tsx`
  außerhalb des Zod/`react-hook-form`-Schemas (eigener `useState`,
  initialisiert aus `content.*`), werden aber beim Submit in denselben
  `POST`/`PATCH /api/content`-Request gemischt.

## Warum diese Lösung

- **OG-Titel/-Beschreibung fallen visuell auf SEO-Titel/Meta-Description
  zurück** (`placeholder` zeigt den jeweils anderen Wert, wenn das
  OG-Feld leer ist) – spiegelt das reale Verhalten wider, das ein
  Downstream-Consumer typischerweise implementiert (OG-Tags defaulten
  auf die SEO-Werte), macht es aber am Editor selbst sichtbar, ohne dass
  serverseitig ein Fallback-Wert persistiert werden muss (bleibt `null`,
  bis explizit überschrieben).
- **`twitterCard` als `string | null` mit Sentinel `"none"` im
  Frontend-State**: Der native `<Select>` kann kein `null` als Wert
  führen, daher State-seitig `"none"` verwenden und beim Submit auf
  `null` mappen (gleiches Muster wie `logoExpandedUrl`/
  `logoCollapsedUrl` in den Settings – `@IsOptional()` in
  `class-validator` überspringt Validierung für `null` **und**
  `undefined`, der `@IsIn(['summary','summary_large_image'])`-Constraint
  greift dadurch nicht bei explizitem `null`).
- **OG-Bild nutzt den bestehenden `ImagePickerDialog`** (bisher nur im
  Rich-Text-Editor verwendet) statt eines neuen Upload-Mechanismus –
  dritte Wiederverwendung dieser Komponente in diesem Projekt.
- **Kein separates `ogTitle`/`ogDescription`-Pflichtfeld** – beide
  optional, damit ein Redakteur ohne Zusatzaufwand einfach nur den
  SEO-Titel pflegen kann, wenn ihm OG-spezifische Werte egal sind.

## Bewusst nicht Teil dieses Batches

- **XML-Sitemap / `robots.txt` (site-weit)**: strasev ist ein headless
  CMS – `apps/web` ist ausschließlich das Admin-Dashboard, es gibt in
  diesem Repo keine öffentliche Seite, die eine Sitemap tatsächlich
  bräuchte. Eine sinnvolle Umsetzung bräuchte zusätzlich eine
  konfigurierbare "öffentliche Basis-URL" (gibt es aktuell nicht in
  `AppSettings`) und wäre ein eigener, in sich abgeschlossener
  Backend-Endpoint (`GET /v1/sitemap.xml` o.ä.) für externe
  Downstream-Sites – bewusst nicht spekulativ mitgebaut, da niemand es
  angefragt hat und die Anforderungen (welche Basis-URL? welches
  Locale-Handling?) ungeklärt sind.
- **SEO-Analyse mit Hinweisen** und **Weiterleitungen (301/302)**: beides
  eigenständige, größere Features (Analyse bräuchte Heuristiken/Regeln,
  Redirects ein eigenes Datenmodell + Middleware) – separat geplant statt
  in dieses Feld-Update gequetscht.

## Relevante Dateien

- `packages/database/prisma/schema.prisma` (`Content`), Migration
  `add-content-seo-fields`
- `apps/api/src/content/dto/create-content.dto.ts`,
  `content.service.ts` (`create()` – explizite Feldliste, `update()`
  spreadet `dto` bereits automatisch durch)
- `apps/web/src/lib/api-server.ts` (`ContentDetail`)
- `apps/web/src/components/content-editor-form.tsx`
- `apps/api/test/content.e2e-spec.ts` (Default-Werte bei Neuanlage,
  Persistenz aller neuen Felder, 400 bei ungültigem `twitterCard`)

## Offene Punkte

- Siehe "Bewusst nicht Teil dieses Batches" oben.
- Kein Zeichen-Limit-Hinweis/-Warnung im UI (z.B. "SEO-Titel sollte
  &lt;60 Zeichen sein") – reine Freitext-Felder ohne Validierung.
