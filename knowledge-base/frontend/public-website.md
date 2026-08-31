# Frontend: die öffentliche Website (`apps/site`)

**Datum:** 2026-08-31
**Betroffene Bereiche:** apps/site (neu) | apps/api | packages/blocks | packages/database

Begriffsklärung vorweg (Nutzervorgabe, siehe
[taxonomy-management.md](./taxonomy-management.md#update-2026-08-31-2-folgetag-rss-feed-archiv-einstellungen-und-die-frontendbackend-begriffsklärung)):
**"Backend"** = die Verwaltungsoberfläche (`apps/api` + `apps/web`),
**"Frontend"** = die öffentliche Website, die Besucher sehen. Dieser
Eintrag beschreibt das Frontend. Jede Installation – der Master (Pivot
selbst) wie jeder Mandant – hat beides als eigene, physisch getrennte Kopie
mit eigener Datenbank (siehe
[master-slave-licensing.md](../platform/master-slave-licensing.md)).

## Was wurde gebaut

Umsetzung des genehmigten Architekturplans in drei bisher abgeschlossenen
Schritten:

**Schritt 1 – Content-Delivery-API + Einstellungen-Bereich "Frontend"**
(Commit `26c665c`): neue `AppSettings`-Felder (`siteTitle`, `siteTagline`,
`faviconUrl`, `defaultSeoDescription`, `defaultOgImageUrl`,
`publicBaseUrl`, `mainNavigationId`), ein neuer Bereich "Frontend" in den
Einstellungen und das API-Modul `apps/api/src/public-content/` mit
`GET /public/site`, `/public/navigation/:slug`, `/public/pages/:slug`,
`/public/categories/:slug(/:contentSlug)` und `/public/sitemap.xml`. Alle
Routen sind `@Public()` und liefern ausschließlich `PUBLISHED`, nicht
gelöschte Inhalte.

**Schritt 2 – gemeinsames Block-Rendering** (Commit `c5f22c0`): die reine
Render-/Wertelogik aus `apps/web/src/components/block-field-output.tsx`
liegt jetzt im Workspace-Paket `packages/blocks` (`@pivot/blocks`);
`apps/web` importiert weiterhin über dünne Re-Export-Shims.

**Schritt 3 – Grundgerüst `apps/site`** (dieser Eintrag): eigene Next.js-App
(Port 3002) mit

- `src/app/layout.tsx` – lädt `GET /public/site` und setzt daraus Titel
  (inkl. `%s – <Titel>`-Template), Beschreibung, Favicon, `metadataBase`
  und OG-Defaults; Kopf-/Fußbereich zeigen Titel und Tagline. Die
  Akzentfarbe der Installation überschreibt das Theme-Token
  `--color-accent` per Inline-Style auf `<html>`.
- `src/app/[slug]/page.tsx` – freie Seiten (Content **ohne** Kategorie)
  unter `/{content-slug}`, inklusive vollständiger SEO-Metadaten pro Seite
  (`seoTitle`/`seoDescription`/`ogTitle`/`ogDescription`/`ogImageUrl`/
  `twitterCard`/`robotsIndex`/`robotsFollow`) und berechnetem
  `canonical`-Fallback.
- `src/app/page.tsx` – die Startseite (`GET /public/home`), gerendert mit
  derselben `ContentArticle`-Komponente wie freie Seiten.
- `src/app/sitemap.xml/route.ts` – reicht `GET /public/sitemap.xml` durch.
- `src/components/content-blocks.tsx` – rendert `Content.data` über
  `@pivot/blocks`, also mit exakt derselben Logik wie die Redakteurs-
  Vorschau im Backend.
- `src/lib/api.ts` – serverseitiger Client gegen die Content-Delivery-API,
  jeder Aufruf mit `next: { revalidate: 60 }`.

## Warum diese Lösung

- **Eigene App statt Route in `apps/web`:** Backend und Frontend haben
  eigene Design-Sprachen und eigene Zielgruppen; `apps/site` bringt darum
  ein eigenes, kleines Token-Set in seiner `globals.css` mit statt das
  Admin-Theme zu erben. Nur die fünf Token-Namen, die `@pivot/blocks`
  verwendet (`bg-muted`, `text-muted-foreground`, `border-border`,
  `border-input`, `divide-border`), existieren bewusst unter denselben
  Namen – sonst würden die gemeinsamen Block-Komponenten im Frontend
  ungestylt aussehen.
- **Kein zweites Block-Rendering:** Vorschau (Backend) und echte Website
  (Frontend) nutzen dieselben Komponenten, damit sie nicht auseinander
  driften – der einzige Grund für Schritt 2.
- **`revalidate: 60` statt Rebuild/Webhook:** bewusst gewählter Kompromiss
  (Nutzerentscheidung) – eine frische Veröffentlichung ist im ungünstigsten
  Fall 60 Sekunden später öffentlich sichtbar, dafür braucht es keine
  Deploy-/Webhook-Infrastruktur, die es aktuell ohnehin nicht gibt.
- **Sitemap wird durchgereicht, nicht neu gebaut:** die API kennt bereits
  alle veröffentlichten Inhalte und respektiert `robotsIndex`; eine zweite
  Sammel-Logik im Frontend wäre eine Drift-Quelle. Ohne gepflegte
  `publicBaseUrl` liefert sie bewusst eine leere Sitemap statt erfundener
  URLs.

## Stolpersteine / Besonderheiten

- **Modul-Typen/globale Module sind Pflicht zum Rendern:** `Content.data.
blocks` enthält nur `moduleTypeId` + Werte; ohne `GET /module-types` und
  `GET /global-modules` (beide bereits `@Public()`, ursprünglich für die
  anonyme Vorschauseite) lässt sich kein Block auflösen.
- **Formular-Bausteine rendern im Frontend noch nichts:**
  `BlockFieldOutput` bekommt bewusst kein `renderForm` – die öffentliche
  Formular-Übermittlung (BFF-Proxy + UI-Bausteine) ist noch nicht gebaut.
  Ein Formular-Block auf einer öffentlichen Seite ist damit aktuell
  unsichtbar, statt halb zu funktionieren.
- **Medien-URLs:** `resolveImageSrc()` aus `@pivot/blocks` hängt
  `NEXT_PUBLIC_API_ORIGIN` vor relative Upload-Pfade – dieser Wert landet
  im Browser und muss in `apps/site/.env.local` auf die öffentlich
  erreichbare API-Adresse zeigen, nicht auf `localhost`.
- **`export const revalidate` muss ein Literal sein:** Next.js wertet den
  Segment-Wert statisch aus, ein importierter `REVALIDATE_SECONDS` würde
  dort nicht funktionieren – die Konstante in `lib/api.ts` gilt nur für die
  `fetch()`-Aufrufe.
- **`twitterCard` ist ein freier String im Datenmodell** (Default `"none"`);
  übernommen werden nur `summary`/`summary_large_image`, weil `app`/`player`
  Pflichtangaben verlangen, die das Datenmodell nicht kennt.
- **404 ist ein Normalfall, kein Fehler:** der API-Client übersetzt
  HTTP 404 in `null`, die Seite ruft dann `notFound()` – nur echte Fehler
  (5xx) werfen.

## Relevante Dateien

- `apps/site/src/app/layout.tsx`, `apps/site/src/app/[slug]/page.tsx`,
  `apps/site/src/app/sitemap.xml/route.ts`
- `apps/site/src/components/content-blocks.tsx`, `apps/site/src/lib/api.ts`
- `apps/site/src/app/globals.css` (eigenes Token-Set + `@source` auf
  `packages/blocks/src`), `apps/site/next.config.ts` (`transpilePackages`)
- `apps/api/src/public-content/public-content.{controller,service}.ts`
- `packages/blocks/src/` (gemeinsames Rendering)

## Update 2026-08-31: Inhalts-Endpunkte antworten nullable statt mit 404

**Fund beim Testen der Startseite:** wurde die Startseite entfernt oder ihre
Seite auf Entwurf zurückgesetzt, lieferte `apps/site` unter `/` **weiterhin
die alte Seite aus** – nicht 60 Sekunden lang, sondern unbegrenzt. Reproduziert
und eingegrenzt:

- Es ist **nicht** der Full Route Cache: auch mit
  `export const dynamic = "force-dynamic"` blieb die alte Seite stehen.
- Es ist der **Data Cache** von `fetch()`: Next.js schreibt fehlgeschlagene
  Antworten (hier HTTP 404) nicht in den Cache und liefert stattdessen den
  zuletzt erfolgreichen Treffer weiter aus. Der abgelaufene Eintrag wird also
  nie ersetzt, solange die API 404 antwortet.

**Lösung:** die Inhalts-Endpunkte der Content-Delivery-API antworten immer mit
HTTP 200 und einem nullable Feld:

```json
{ "content": null }
```

Betrifft `GET /public/home`, `GET /public/pages/:slug` und
`GET /public/categories/:slug/:contentSlug`. `apps/site` ruft weiterhin
`notFound()` auf, wenn `content === null` – die 404 entsteht also im
Frontend, nicht mehr in der API. Die 404-Behandlung im API-Client bleibt als
Sicherheitsnetz für Routen, die es wirklich nicht gibt.

**Verifiziert** (jeweils mit echtem Umschalten in der Datenbank und 65 s
Wartezeit): Startseite auf eine veröffentlichte Seite → `/` wird nach einem
Revalidierungszyklus 200; Startseite zurück auf einen Entwurf → `/` wird nach
einem Zyklus wieder 404. Vor der Änderung blieb dieser zweite Fall dauerhaft
auf 200. Das erwartete Stale-While-Revalidate-Verhalten bleibt erhalten: die
erste Anfrage nach Ablauf liefert noch den alten Stand und stößt die
Aktualisierung an, ab der zweiten ist es der neue.

**Noch nicht umgestellt:** `GET /public/categories/:slug` (Kategorie-Archiv)
wirft weiterhin 404, wenn die Kategorie fehlt oder `archivePublished` aus ist –
derselbe Effekt wäre dort zu erwarten. Wird mit Schritt 4 des Frontend-Plans
mit umgestellt, sobald es diese Seite im Frontend überhaupt gibt.

## Offene Punkte

- ~~Startseite (`/`)~~ **gelöst am 2026-08-31**: die Startseite wird am
  Menüpunkt markiert (`NavigationItem.isHomepage`, Badge in der
  Menü-Verwaltung, app-weit nur einer). `apps/site`s `app/page.tsx`
  rendert dafür `GET /public/home`; ohne Markierung bleibt `/` eine
  ehrliche 404. Details:
  [navigation-management.md](../content/navigation-management.md#update-2026-08-31-startseite-wird-am-menüpunkt-gesetzt).
- Schritt 4 des Plans: Kategorie-Archiv `/[category]` (Aufmacher-Kachel,
  Pagination) und Beitragsseite `/[category]/[slug]`.
- Schritt 5 des Plans: Hauptmenü im Header (`mainNavigationId` →
  `GET /public/navigation/:slug`), RSS-`<link>` bei `rssEnabled`,
  `robots.txt`.
- Mehrsprachigkeit/Locale-Routing (`Content.locale` existiert, ist aber
  nicht ans Routing angebunden) – v1 geht von einer Sprache pro
  Installation aus (`DEFAULT_LOCALE = "de"` im `PublicContentService`).
- Visuelle Gestaltung: das aktuelle Layout ist bewusst minimal
  (Titel/Tagline, zentrierte Inhaltsspalte) – die eigentliche Design-Runde
  fürs Frontend steht noch aus.
- Ende-zu-Ende teilweise verifiziert: `/sitemap.xml`, das 404-Verhalten und
  – seit der Startseiten-Änderung – eine echt gerenderte Inhaltsseite
  inklusive Block-Ausgabe über `@pivot/blocks` (`/` mit testweise
  markierter Startseite, danach wieder zurückgesetzt). Eine **freie** Seite
  (`/{slug}`) konnte weiterhin nicht geprüft werden: in der Dev-DB gibt es
  keinen veröffentlichten Inhalt ohne Kategorie.
