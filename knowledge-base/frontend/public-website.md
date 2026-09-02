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

## Update 2026-09-02: Schritt 4 – Kategorie-Archiv und Beitragsseite

Ausgelöst durch eine Fehlersuche, nicht durch einen Feature-Wunsch:
`/datenschutz` und andere Seiten lieferten auf der Website 404. Ursache war
kein Bug, sondern eine Lücke – `apps/site` hatte genau **zwei** Routen
(`/` und `/[slug]`), für zweisegmentige Pfade gab es gar keine. Die
Backend-Seite (`getCategory`, `getCategoryPost`, `buildContentPath`) war
seit 2026-08-31 fertig und wies längst Pfade der Form
`/{kategorie}/{slug}` aus, die niemand ausliefern konnte. **Jede Seite mit
Kategorie war damit öffentlich unerreichbar.**

Zur Fehlersuche gehörten zwei weitere Befunde, beide reine Datenlage:
`/` war 404, weil die als Startseite markierte Seite auf `DRAFT` stand
(`getHome()` verlangt `PUBLISHED`), und eine der beiden Kategorien der
Testseite lag im Papierkorb.

### Routen

- `app/[slug]/page.tsx` löst jetzt **zwei** Fälle auf: erst freie Seite
  (`getPage`), sonst Kategorie-Archiv (`getCategoryArchive`). Next.js
  erlaubt auf einer Ebene nur ein dynamisches Segment, deshalb die
  Laufzeit-Entscheidung statt zweier Routen. Bei einer Slug-Kollision
  gewinnt bewusst die Seite.
- `app/[slug]/[postSlug]/page.tsx` ist neu: die Beitragsseite. Das Backend
  prüft die Kategorie-Zuordnung mit, ein Beitrag ist also nicht unter
  jeder beliebigen Kategorie-URL erreichbar.

### Kategorien als Menüziel

Nutzervorgabe: *"kategorie soll in menü auswählbar sein. aktuell ist da
seite und externe url … das funktioniert dann wie ein blog"*.
`NavigationItem` hat dafür ein **drittes** Ziel bekommen (`categoryId`),
`assertExactlyOneTarget()` zählt seitdem statt paarweise zu vergleichen.
Eine Kategorie kann nicht Startseite sein – `getHome()` liefert genau
einen Content, ein Archiv als Startseite wäre ein eigenes Feature.

Im öffentlichen Menü werden Kategorie-Punkte **ausgeblendet**, deren
Übersichtsseite nicht veröffentlicht oder deren Kategorie im Papierkorb ist –
dieselbe Logik, die es für unveröffentlichte Inhalte schon gab. Im Backend
bleibt der Punkt sichtbar und der Dialog warnt stattdessen
(Nutzerentscheidung: warnen statt `archivePublished` still mitzusetzen).

**Nebenbei behoben:** `getNavigation()` baute den Link zu einem Inhalt fest
als `/{slug}` – für einen Beitrag MIT Kategorie also auf eine 404-URL. Er
nutzt jetzt dasselbe `buildContentPath()` wie alle anderen Stellen.

### Zwei Darstellungen, beide paginiert

Nutzerentscheidung nach Rückfrage: `LIST` = kompakt (Titel + Datum),
`BLOCKS` = Karte mit Titelbild, Datum und Anreißtext. **Beide** blättern
über das bereits vorhandene `Category.postsPerPage`. Das Titelbild ist
`Content.ogImageUrl` aus dem SEO-Tab – das einzige echte "Bild dieser
Seite" im Datenmodell; fehlt es, entfällt der Bildbereich ersatzlos.

Die Aufmacher-Kachel (`Category.showFeaturedLarge`) erscheint nur auf
Seite 1 – auf Folgeseiten wäre sie eine Dublette.

**Die Einstellung sitzt am Menüpunkt, nicht an der Kategorie**
(Nutzerentscheidung, ausdrücklich gegen die empfohlene Variante): dieselbe
Kategorie darf in zwei Menüs unterschiedlich aussehen. Daraus folgt ein
Problem, das die Alternative nicht gehabt hätte – die öffentliche URL ist
nur `/{slug}` und kennt den Menüpunkt nicht. `resolveArchiveLayout()` löst
das auf, in dieser Reihenfolge:

1. Menüpunkt im Hauptmenü (`AppSettings.mainNavigationId`) – das Menü, das
   die Website tatsächlich anzeigt,
2. sonst der älteste Menüpunkt, der auf die Kategorie zeigt,
3. sonst `LIST` (Übersichtsseite direkt aufgerufen, kein Menüpunkt).

### Nachtrag: der Menüpunkt IST die Veröffentlichung

Zunächst musste zusätzlich zum Menüpunkt der Schalter
"Übersichtsseite veröffentlichen" (`Category.archivePublished`) gesetzt
werden; der Menüpunkt-Dialog warnte, solange er aus war. In der Praxis
war das eine Stelle zu viel – Nutzerrückmeldung: *"das macht kein sinn,
wenn unter menü kategorie liste ausgewählt wurde"* und dann *"die
zusätzliche einstellung in der kategorie wird nicht gebraucht"*.

**Neue Regel:** die Übersichtsseite einer Kategorie ist genau dann
öffentlich, wenn ein Menüpunkt auf sie zeigt. `getCategory()` zählt dafür
die `NavigationItem`s mit dieser `categoryId`, statt ein Flag zu lesen.
Der Schalter auf der Kategorien-Seite und die Warnung im Menüpunkt-Dialog
sind entfallen; `getNavigation()` blendet Kategorie-Punkte nur noch aus,
wenn die Kategorie im Papierkorb liegt.

**`Category.archivePublished` ist am selben Tag ganz entfallen** – erst
blieb die Spalte als toter Rest stehen, auf Nutzerwunsch wurde sie dann
mitsamt `CreateCategoryDto`/`UpdateCategoryDto` und `CategoryDetail`
entfernt. Alle drei vorhandenen Kategorien standen ohnehin auf `false`,
es ging also nichts verloren.

**Live verifiziert:** `xfhxfhg` (ein Menüpunkt zeigt darauf) liefert
`layout: "LIST"`, `sadfadsgh` und `xcvbv` (kein Menüpunkt) liefern
`category: null`.

### Bekannte Grenze: eine Kategorie, eine URL

Die Darstellung sitzt am Menüpunkt, damit dieselbe Kategorie an zwei
Stellen unterschiedlich aussehen kann (ausdrücklicher Nutzerwunsch:
*"wenn ich ein und die selbe kategorie habe, möchte ich die vielleicht als
liste darstellen woanders aber als block"*). **Das löst die aktuelle
Umsetzung nicht:** beide Menüpunkte verlinken auf `/{kategorie}` – es gibt
nur eine URL, und die Seite weiß nicht, worüber jemand gekommen ist.
`resolveArchiveLayout()` wählt deshalb einen Menüpunkt aus (Hauptmenü
zuerst, sonst der älteste); der zweite bleibt wirkungslos.

Zwei diskutierte Wege, beide noch nicht gebaut:

- **Darstellung in der URL** (`/{kategorie}?ansicht=bloecke`), klein, aber
  eine technisch wirkende Zweit-URL; `canonical` müsste auf die schlichte
  Adresse zeigen.
- **Baustein "Kategorie-Liste"** im Seiten-Designer: zwei normale Seiten
  (`/blog`, `/aktuelles`) binden dieselbe Kategorie unterschiedlich ein,
  das Menü zeigt auf diese Seiten. Saubere URLs, beliebig viele Varianten
  – dafür fiele das Kategorie-Menüziel mittelfristig weg.

### Kategorie-Endpunkt jetzt nullable

Der offene Punkt "Kategorie-Übersichts-Endpunkt auf nullable Antwort
umstellen" ist damit erledigt: `getCategory()` liefert
`{ category: null, … }` statt einer 404, aus demselben Cache-Grund wie die
Inhalts-Endpunkte (siehe Update 2026-08-31 oben).

## Update 2026-09-02: Vorschau öffnet die echte Website

Nutzervorgabe: *"wenn ich bei seiten auf vorschau klicke, soll die seite im
frontend aufgerufen werden"* – und direkt danach die entscheidende
Einschränkung: *"da aber nur mit backendrecht bei vorschau"*.

Der Augen-Knopf in der Seiten-Liste zeigte bisher auf die Backend-Vorschau
(`/dashboard/content/[id]/preview`). Er führt jetzt über die neue
BFF-Route `GET /api/content/[id]/frontend-preview`, die

1. per `POST /content/:id/preview-links` einen **einstündigen** Token
   ausstellt (kurz, weil das ein Blick auf die eigene Seite ist und kein
   teilbarer Freigabe-Link – dafür gibt es weiterhin Vorschau-Links mit 7
   Tagen),
2. den öffentlichen Pfad der Seite bildet (dieselbe Regel wie
   `buildContentPath()`),
3. auf `{website}/{pfad}?preview={token}` weiterleitet.

**Da liegt die Absicherung:** die Website hat keine Anmeldung, der Token
ist das Recht. Ausstellen darf ihn nur, wer `preview-links:create` besitzt
– fehlt es, reicht die Route die Backend-Meldung unverändert durch. Ein
Umweg über ein Cookie schied aus: `apps/site` ist eine eigene App ohne
Auth, und Cookies gelten pro Host, nicht pro Port (siehe die
Cookie-Kollision in
[master-slave-licensing.md](../platform/master-slave-licensing.md)).

Neu dafür: `GET /public/preview/:token` im `PublicContentController` –
liefert dieselbe Form wie `pages/:slug` (inkl. `path`), bewusst **ohne**
Status-Filter (eine Vorschau soll ja den unveröffentlichten Stand zeigen),
aber ohne Papierkorb. Das ältere `GET /content/preview/:token` bleibt
unangetastet; es liefert die rohe Admin-Projektion für die
Backend-Vorschauseite.

Auf der Website wertet `?preview=` beide Routen aus, holt den Inhalt mit
`cache: "no-store"` (sonst sähe man seine eigene Änderung bis zu 60
Sekunden lang nicht) und blendet eine `PreviewNotice`-Leiste ein, damit
eine Vorschau nicht mit der echten Seite verwechselt wird.

**Warum ein `<a target="_blank">` und kein `window.open()`:** die Route
muss erst den Token holen, und ein `window.open()` nach einem `await`
fängt der Popup-Blocker ab. Deshalb ist es eine GET-Route, die
weiterleitet.

**Ohne jede Konfiguration nutzbar** (Nutzerrückfrage, 2026-09-02: "kann
man es so bauen, dass das frontend immer aufrufbar ist als vorschau für
seiten? ohne eintragung in einstellung frontend?"). Die Basis-URL wird
gestaffelt ermittelt, eine gepflegte Einstellung gewinnt aber immer:

1. `AppSettings.publicBaseUrl` (Einstellungen → Frontend) – die einzige
   Quelle, die die echte öffentliche Domain kennt.
2. `SITE_URL` aus der Umgebung – für Deployments, die die Website unter
   einer anderen Adresse betreiben als das Backend.
3. Entwicklung: fest `http://localhost:3002`. Kein geratener Wert –
   `apps/site` startet laut seiner package.json immer auf diesem Port.
   Deckt den direkten Aufruf über Port 3000 genauso ab wie den über
   `pnpm dev:proxy`.
4. Produktion ohne alles: dieselbe Origin. Das trifft das Ein-Domain-
   Layout; der `/admin`-Basispfad fällt automatisch weg, weil
   `URL.origin` den Pfad nicht enthält.

### Stolperstein: `<Link href={bff(...)}>` ergibt einen doppelten basePath

Erster Klick auf den neuen Knopf lieferte **404** (Nutzer-Bugreport per
Screenshot). Ursache war nicht die Route, sondern der Link davor: der
Knopf war als `<Link href={bff("/api/…")}>` gebaut. `bff()` setzt
`/admin` davor – und Next.js' `<Link>` setzt den `basePath` **noch
einmal** davor. Der Browser rief also `/admin/admin/api/…` auf, was nach
dem Strippen eines `/admin` auf keine Route mehr passte.

`lib/bff.ts` warnt genau davor ("`<Link>`, `useRouter()` und
`next/image` brauchen das **nicht**, die setzen den `basePath` selbst") –
die Falle ist trotzdem leicht zu übersehen, weil alle anderen Aufrufe im
Code `fetch(bff(...))` sind, wo `bff()` zwingend nötig ist.

**Erkennungsmerkmal im Dev-Log:** eine getroffene Route wird ohne
basePath protokolliert (`GET /api/…`), eine verfehlte MIT
(`GET /admin/api/… 404`). Genau dieser Unterschied zwischen den eigenen
`curl`-Tests und den Klicks des Nutzers hat den Fall aufgeklärt.

**Fix:** rohes `<a href={bff(...)} target="_blank">` statt `<Link>`. Für
eine Route, die auf eine andere Origin weiterleitet, ist eine echte
Browser-Navigation ohnehin richtig.

Beim selben Umbau ist ein zweiter, noch nicht sichtbar gewordener Fehler
mit weggefallen: die Route baute den Ziel-Pfad zuerst selbst aus
`GET /content/:id`. Dessen Admin-Projektion liefert Kategorien aber als
Join-Zeilen (`{ category: { slug } }`, nicht `{ slug }`) – für jede Seite
MIT Kategorie wäre `/undefined/slug` herausgekommen. Jetzt liefert
`GET /public/preview/:token` den `path` gleich mit, gebildet von
`buildContentPath()` wie überall sonst.

### Live verifiziert

```
/public/preview/<ungültig>          → {"content":null}
/api/content/x/frontend-preview     → 401 ohne Sitzung
/gghhjfh            (DRAFT, ohne Token) → 404
/gghhjfh?preview=<token>                → 200 + "Vorschau."-Leiste
/xcvbv/gghhjfh?preview=<token>          → 200 (Beitragsroute)
/sadfadsgh                              → Archiv, LIST und BLOCKS je nach Menüpunkt
/sadfadsgh/datenschutz                  → 200 (vorher 404)
/sadfadsgh/hfghdh-…                     → 200, Galerie-Baustein rendert (7 Bilder, Swiper)
```

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

## Update 2026-09-02: Verwaiste Backend-Vorschauseite entfernt

`/dashboard/content/[id]/preview` hatte nach der Umstellung des
Vorschau-Knopfs auf die öffentliche Website keinen einzigen Verweis mehr.
Entfernt. Die Komponente `content-preview-render.tsx` bleibt – sie wird
weiterhin von der anonymen Vorschau (`/preview/[token]`) und von der
Versionshistorie (`content-versions-explorer.tsx`) genutzt.

**Stolperstein dabei:** `tsc --noEmit` schlug danach mit „Cannot find
module '.../preview/page.js'" fehl. Ursache war nicht der Code, sondern
`apps/web/.next/types/validator.ts` – ein Build-Artefakt vom 31.08., das
der Dev-Server nicht mitpflegt und das der Type-Check trotzdem mit
einliest. Löschen genügt (liegt in `.next`, also nicht im Git);
`next build` erzeugt es korrekt neu.

## Update 2026-09-02: Formulare auf der Website

Formular-Bausteine wurden auf öffentlichen Seiten bis dahin **still gar
nicht gerendert** – `ContentBlocks` übergab kein `renderForm`. Seitdem
gibt es `public-form.tsx` (eigener Renderer mit nativen Elementen, weil
`apps/site` bewusst kein shadcn/ui hat) und darunter optional den
Selbstauskunft-Footer.

Neu dabei auch das erste Mal Proxy-Routen unter `apps/site/src/app/api/`:
die API lässt per `CORS_ORIGIN` nur eine Herkunft zu, ein direkter
Browser-Aufruf von der Website aus scheitert. Wer hier weitere
API-Aufrufe aus dem Browser braucht, geht denselben Weg.

Vollständige Beschreibung in
[forms.md](../content/forms.md#update-2026-09-02-4-formulare-erscheinen-endlich-auf-der-website).

## Update 2026-09-02 (2): Echte Hülle – Header und Footer

Bis hierher hatte `apps/site` bewusst nur ein Platzhalter-Gerüst (Titel
oben, Titel unten). Der Nutzer hat einen fertigen Entwurf geliefert
(„Pivot Landing.html") mit der Vorgabe: **Header und Footer übernehmen,
alle Inhalte kommen über den Seiten-Designer.**

**Woher der Entwurf kam.** Eine 735-KB-Einzeldatei aus einem
Baukasten-System: 661 KB Assets als Base64 (Hero-JPEG, 18 WOFF2-Schnitte),
das Markup als JSON-String in einer einzigen Zeile. Reines HTML mit
Inline-Styles, kein Framework. Zwei Attribute daraus (`style-hover="…"`,
`sc-camel-on-click="{{ … }}"`) sind proprietär und mussten zu echtem CSS
bzw. React werden.

**Das übernommene Design-System** liegt jetzt in `globals.css`:

| | |
| --- | --- |
| Grund | `#fbfbf9`, abgesetzt `#f2f2ec` |
| Dunkel (Footer) | `#0e1116` |
| Akzent | `#c6e86a`, Hover `#b7dd54`, Link-Hover `#5c7a12` |
| Schrift | Manrope (400–800), IBM Plex Mono für Versal-Label |
| Bahn | max. 1180px |

Die Schriften kommen über `next/font/google`, nicht über einen `<link>`:
so werden sie mitgebaut und lokal ausgeliefert – auf einer Website mit
Datenschutzerklärung wiegt das schwerer als die gesparte Verbindung. Neu
ist außerdem die eigene Utility `eyebrow` für die kleinen Mono-Label.

**Nichts am Header und Footer ist hart verdrahtet:**

| Stelle | Quelle |
| --- | --- |
| Logo-Kachel + Wortmarke | `siteTitle` (endet er auf einen Punkt, wird der abgetrennt und farbig gesetzt – „Pivot**.**") |
| Header-Menü | `AppSettings.mainNavigationId` |
| „Anmelden" / „Demo buchen" | ganz normale Menüpunkte mit `NavigationItem.appearance` |
| Footer-Spalte 1 + 2 | zwei frei gewählte Navigationen; **Spaltenüberschrift ist der Name der Navigation** |
| Footer-Spalte 3 | automatisch aus `LegalDocument` |
| Claim im Footer | `siteTagline` |
| Copyright | `companyName`, ersatzweise der Website-Titel |
| Zusatzzeile rechts | `AppSettings.footerNote` |

Damit ist auch **Schritt 5 des Frontend-Plans** erledigt: `mainNavigationId`
hatte seit seiner Anlage kein Eingabefeld und war deshalb nie gesetzt.

**Warum `appearance` am Menüpunkt und nicht als zwei Einstellungsfelder:**
zwei Felder „Knopf 1" / „Knopf 2" hätten die Anzahl der Handlungsaufrufe
für immer auf zwei festgelegt. Als Darstellungs-Flag am Menüpunkt sind es
gewöhnliche Menüeinträge – umbenennbar, verschiebbar, löschbar. Dieselbe
Begründung wie bei `categoryLayout` am Menüpunkt statt an der Kategorie.

**Eine Relation weniger streng.** `AppSettings` zeigt jetzt DREIMAL auf
`Navigation`, daher tragen alle drei Relationen einen Namen. Dabei ist das
frühere `@unique` auf `mainNavigationId` gefallen: es hätte verboten,
dieselbe Navigation gleichzeitig als Hauptmenü und als Footer-Spalte zu
verwenden – eine plausible Absicht. Es gibt ohnehin nur eine
AppSettings-Zeile.

**Bewusst weggelassen:** der Knopf „Cookie-Einstellungen" aus dem Entwurf.
Einen Cookie-Banner gibt es hier nicht, der Knopf hätte nichts zu öffnen.
Der Rechtstext „Cookie-Hinweis" erscheint als normaler Link in der
Rechtliches-Spalte.

**Bekannte Grenze.** Die Inhaltsbahn (1180px) liegt in der Hülle, nicht im
Baustein. Randlose Abschnitte über die volle Fensterbreite – im Entwurf
der Hero und das Branchen-Band – kann deshalb heute kein Modultyp. Das
aufzubrechen ist ein eigener Schritt am Designer. Ebenso fehlen für die
Landingpage noch Modultypen für Feature-Kacheln, Ablauf-Schritte und
Preistabelle; die vorhandenen zwölf decken Hero (Cover), Text, Bild,
Galerie, FAQ und Formular ab.
