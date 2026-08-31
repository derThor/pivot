# Deployment: eine Domain für Website, Backend und API

**Datum:** 2026-08-31
**Betroffene Bereiche:** apps/site | apps/web | apps/api | Betrieb (Reverse Proxy, Prozessmanager)

Alle Domains in diesem Kapitel sind Platzhalter – überall, wo
`kunde.de` steht, gehört die echte Domain der jeweiligen Installation hin.

## Zielbild

Eine Installation (Master wie Mandant) besteht aus drei Prozessen auf einem
Server. Sie liegen alle unter **einer** Domain, aufgeteilt über Pfade
(Nutzerentscheidung, 2026-08-31 – bewusst statt Subdomains, siehe
"Bewertung" unten):

```
https://kunde.de/              →  127.0.0.1:3002   apps/site   öffentliche Website
https://kunde.de/admin/…       →  127.0.0.1:3000   apps/web    Backend (Next basePath)
https://kunde.de/api/…         →  127.0.0.1:3001   apps/api    NestJS-API
https://kunde.de/api/uploads/… →                                Medien (Browser)
```

DNS: ein A-Record auf die Server-IP, dazu `www` als CNAME oder
Weiterleitung. Kein CORS nötig – alles ist derselbe Origin.

## Bewertung: Pfade statt Subdomains

Beides ist üblich; Pfad-Varianten fahren WordPress (`/wp-admin`), Ghost
(`/ghost`) und Payload (`/admin`). Für pivot wurde bewusst die Pfad-Variante
gewählt (eine Domain, ein Zertifikat, kein CORS, einfacher für Mandanten).
Die Kosten dieser Entscheidung, gemessen am Code-Stand vom 2026-08-31:

- **179 Client-`fetch()`-Aufrufe in 90 Dateien** mussten das
  `basePath`-Präfix bekommen – Next.js setzt `basePath` auf Links, Assets
  und Router, **nicht** auf `fetch()`-URLs. Gelöst über den Helfer
  `apps/web/src/lib/bff.ts`.
- **Session-Cookies** liefen auf `path: "/"` und wären damit bei jedem
  Besucher-Request an die öffentliche Website mitgeschickt worden – ein
  vorgelagertes CDN cached Antworten mit Cookies üblicherweise nicht.
  Cookies laufen deshalb auf dem Backend-Pfad.
- **Gemeinsamer Origin**: öffentliche Seite und Backend teilen sich den
  Browser-Origin. Cookies sind `httpOnly` + `sameSite: lax`, aber die harte
  Trennung, die Subdomains liefern, gibt es hier nicht. Bewusst akzeptiert.
- **Reservierte Slugs**: `admin` und `api` dürfen nicht als Seiten- oder
  Kategorie-Slug vergeben werden, sonst wäre der Inhalt nicht erreichbar.
  Wird serverseitig abgelehnt.

Wer stattdessen Subdomains fahren will (`admin.kunde.de`, `api.kunde.de`),
setzt `NEXT_PUBLIC_BASE_PATH=""` – dann läuft das Backend wieder auf der
Wurzel seiner eigenen Domain, ohne Codeänderung.

## Umgebungsvariablen

`apps/site/.env`

```
API_URL=http://127.0.0.1:3001/v1             # serverseitig, nie öffentlich
NEXT_PUBLIC_API_ORIGIN=https://kunde.de/api  # Browser: Medien-URLs
```

`apps/web/.env`

```
API_URL=http://127.0.0.1:3001/v1
NEXT_PUBLIC_API_ORIGIN=https://kunde.de/api
NEXT_PUBLIC_BASE_PATH=/admin                 # "" für Subdomain-Betrieb
NODE_ENV=production
```

`apps/api/.env`

```
DATABASE_URL=postgresql://…
JWT_SECRET=…
CORS_ORIGIN=https://kunde.de                 # nur Schema+Host, kein Pfad
ADMIN_BASE_URL=https://kunde.de/admin        # Basis für Links in E-Mails
PORT=3001
NODE_ENV=production
```

**Wichtig:** `CORS_ORIGIN` war bis 2026-08-31 doppelt belegt – als
CORS-Header **und** als Basis für Passwort-Reset-/Verifikations-Links. Das
geht bei einer Domain nicht mehr auf (ein CORS-Origin verträgt keinen Pfad),
deshalb das eigene `ADMIN_BASE_URL`. Fehlt es, fällt die App auf
`CORS_ORIGIN` zurück – dann zeigen die Mail-Links auf die Wurzel statt auf
das Backend.

In der Oberfläche zusätzlich pflegen: **Einstellungen → Frontend →
Basis-URL der Website** (Grundlage für `canonical`, OG-Tags und Sitemap) und
unter **Seiten → Menüs** einen Menüpunkt als Startseite markieren, sonst ist
`/` eine 404.

## nginx-Beispiel

```nginx
server {
  listen 443 ssl http2;
  server_name kunde.de;

  ssl_certificate     /etc/letsencrypt/live/kunde.de/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/kunde.de/privkey.pem;

  # Für alle drei Blöcke gleich – die Apps brauchen die echten Client-Daten
  # (Rate-Limit, Sitzungs-IPs, korrektes Schema in Redirects).
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_http_version 1.1;
  proxy_set_header Upgrade    $http_upgrade;
  proxy_set_header Connection "upgrade";

  client_max_body_size 64m;   # Medien-Uploads

  # API: das /api-Präfix wird entfernt, die App sieht /v1/… wie lokal.
  # Der abschließende Slash im proxy_pass ist dafür entscheidend.
  location /api/ {
    proxy_pass http://127.0.0.1:3001/;
  }

  # Backend: KEIN Präfix entfernen – die App erwartet /admin selbst
  # (Next basePath).
  location /admin/ {
    proxy_pass http://127.0.0.1:3000;
  }
  location = /admin { return 301 /admin/; }

  # Öffentliche Website – steht als Auffangregel zuletzt.
  location / {
    proxy_pass http://127.0.0.1:3002;
  }
}

server {
  listen 80;
  server_name kunde.de www.kunde.de;
  return 301 https://kunde.de$request_uri;
}
```

Caddy-Variante (kürzer, TLS automatisch):

```
kunde.de {
  handle_path /api/* { reverse_proxy 127.0.0.1:3001 }
  handle /admin/*    { reverse_proxy 127.0.0.1:3000 }
  handle             { reverse_proxy 127.0.0.1:3002 }
}
```

## Lokaler Proxy zum Testen (`pnpm dev:proxy`)

Damit die Pfad-Aufteilung nicht nur auf dem Zielserver das erste Mal läuft,
gibt es `scripts/dev-proxy.mjs` – ein abhängigkeitsfreier Node-Proxy, der
lokal exakt dasselbe Layout abbildet:

```
http://localhost:8080/        → 127.0.0.1:3002  apps/site
http://localhost:8080/admin/… → 127.0.0.1:3000  apps/web
http://localhost:8080/api/…   → 127.0.0.1:3001  apps/api  (Präfix entfernt)
```

Starten mit `pnpm dev:proxy` (Port über `DEV_PROXY_PORT` änderbar),
während die drei Apps normal laufen. Er setzt dieselben
`X-Forwarded-*`-Header wie nginx und reicht WebSocket-Upgrades durch,
damit der Hot Reload im Dev-Modus weiter funktioniert. **Nur ein
Entwicklungswerkzeug** – kein TLS, keine Zugriffskontrolle; produktiv
machen das nginx oder Caddy (Konfiguration unten).

Am 2026-08-31 damit durchgespielt: `/` liefert die Website, `/robots.txt`
die Sperrliste, `/admin` leitet auf `/admin/dashboard`, `/admin/login`
lädt, `/api/v1/public/site` liefert JSON, `/api/uploads/<datei>` liefert
das Bild (Präfix-Strip greift), und ein WebSocket-Upgrade auf
`/admin/_next/webpack-hmr` beantwortet die API mit `101 Switching
Protocols`.

**Hinweis für den vollständigen Durchlauf:** Medien-URLs im Browser kommen
aus `NEXT_PUBLIC_API_ORIGIN`. Lokal steht dort `http://localhost:3001`,
die Bilder gehen also am Proxy vorbei. Wer den Produktionspfad komplett
testen will, setzt in `apps/site/.env.local` und `apps/web/.env.local`
`NEXT_PUBLIC_API_ORIGIN=http://localhost:8080/api` – dann müssen die Apps
aber immer über den Proxy aufgerufen werden.

## Prozesse starten

Kein Watch-Modus, keine Dev-Server. Erst bauen, dann als Dienst laufen
lassen:

```bash
pnpm install --frozen-lockfile
pnpm --filter @pivot/database generate
pnpm --filter @pivot/api build      # nest build  → apps/api/dist
pnpm --filter @pivot/web build      # next build
pnpm --filter @pivot/site build     # next build
```

Start (PM2-Beispiel, systemd geht genauso):

```bash
pm2 start "node dist/main.js" --name pivot-api  --cwd apps/api
pm2 start "pnpm start"        --name pivot-web  --cwd apps/web
pm2 start "pnpm start"        --name pivot-site --cwd apps/site
pm2 save && pm2 startup
```

**Stolperstein aus der Praxis (2026-08-27 und 2026-08-31):** die lokale API
lief wochenlang als _alter_ kompilierter Build weiter. Dadurch schlummerten
zwei Fehler unentdeckt im Quellcode (fehlende `multer`-Dependency; das
Löschen der verknüpften Seite beim Bearbeiten eines Menüpunkts) und fielen
erst beim nächsten echten Build auf. Konsequenz: **nach jedem Build alle
Bereiche gegenprüfen, die seit dem letzten Build nur im Quellcode geändert
wurden**, nicht nur das gerade gebaute Feature.

## Datenbank

Produktiv gilt `prisma migrate deploy` als Teil des Deploys – **nicht**
`db push`. Lokal wird weiterhin `db push` genutzt, weil die Dev-Datenbank
von der Migrationshistorie abgedriftet ist; diese Abdrift muss vor dem
ersten echten Deploy einmal aufgelöst werden (Baseline-Migration aus dem
aktuellen Schema). Das ist der aufwendigste offene Punkt der Liste.

## Verifikationsliste nach einem Deploy

Es gibt keine automatisierten End-to-End-Tests, deshalb von Hand:

1. Startseite: lädt, Bilder erscheinen, `/sitemap.xml` liefert absolute URLs
   mit der richtigen Domain.
2. `/admin`: Login, Logout, Navigation, ein Speichern (z.B. Einstellungen),
   Medien-Upload plus Anzeige des Bildes.
3. Passwort-vergessen anstoßen: der Link in der Mail muss auf
   `…/admin/reset-password?token=…` zeigen.
4. `/api/v1/public/site` liefert JSON.
5. Rate-Limit: mehrere Fehl-Logins von zwei verschiedenen Geräten – es darf
   nicht das ganze System, sondern nur die jeweilige IP gebremst werden
   (setzt `trust proxy` in der API voraus).
6. Eine Seite mit Slug `admin` anlegen – muss abgelehnt werden.

## Master/Slave

Jede Mandanten-Installation ist dasselbe Trio unter ihrer eigenen Domain.
Die Domain muss mit `Website.domain` auf dem Master übereinstimmen, sonst
schlägt die Lizenzprüfung fehl (siehe
[master-slave-licensing.md](./master-slave-licensing.md)). Der Master selbst
ist technisch nur eine weitere Installation.

## Offene Punkte

- CI/CD-Pipeline (Build + Migration + Neustart, für Master **und** jede
  Slave-Installation) – existiert nicht, siehe `docs/ROADMAP.md`.
- Bereitstellung neuer Mandanten-Installationen (eigener Server? Docker?
  Managed Hosting?) ist noch nicht entschieden.
- Baseline-Migration für die abgedriftete Datenbank (siehe oben).
- CDN/Edge-Caching vor der Installation ist möglich (`apps/site` setzt
  bereits `s-maxage` auf der Sitemap), aber nicht eingerichtet.

## Umbau im Code (2026-08-31, abgeschlossen)

Damit das Pfad-Layout funktioniert, wurde folgendes umgesetzt – der Stand
ist also nicht geplant, sondern gebaut:

**apps/web**

- `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/admin"` in
  `next.config.ts`. Gilt auch lokal: das Backend läuft im Dev-Modus jetzt
  unter `http://localhost:3000/admin`.
- Neu: `src/lib/bff.ts` mit `BASE_PATH`, `bff()` (BFF-Routen) und `asset()`
  (Dateien aus `public/`, rohe `window.location`-Navigationen). **243
  URL-Literale in 108 Dateien** wurden per Codemod darauf umgestellt;
  zwei JSX-Attribute (`endpoint=`, `href=`) mussten dabei von Hand in
  geschweifte Klammern gesetzt werden.
- `middleware.ts`: neuer Helfer `internalUrl()` – `nextUrl.pathname` kommt
  ohne `basePath` (Matcher und Präfix-Vergleiche blieben deshalb
  unverändert), Redirect-/Rewrite-Ziele brauchen ihn aber ausgeschrieben.
- `lib/auth.ts`: Cookie-Pfad ist jetzt `BASE_PATH` statt `/`.
- **Nicht** angefasst werden mussten `<Link>`, `useRouter()` und
  `redirect()` aus `next/navigation` – die ergänzen den `basePath` selbst
  (per Test bestätigt: `/admin` antwortet mit
  `Location: /admin/dashboard`).

**apps/api**

- `app.set('trust proxy', 1)` in `main.ts` – ohne das sähe der globale
  `ThrottlerGuard` hinter dem Proxy nur noch 127.0.0.1.
- `ADMIN_BASE_URL` als eigene Umgebungsvariable, benutzt von
  `AuthService.frontendOrigin()` und `MailerService.frontendOrigin()`;
  Fallback bleibt `CORS_ORIGIN`.
- `common/utils/reserved-slugs.ts`: `admin` und `api` werden beim Anlegen
  und Bearbeiten von Inhalten und Kategorien abgelehnt.

**apps/site**

- Neue Route `robots.txt` mit `Disallow: /admin` und `Disallow: /api`,
  plus `Sitemap:`-Zeile, sobald eine öffentliche Basis-URL gepflegt ist.

**Lokal geprüft:** `/` → 404 (gehört der Website), `/admin` → 307 auf
`/admin/dashboard`, `/admin/dashboard` ohne Sitzung → 307 auf
`/admin/login?redirectTo=/dashboard`, Marken-Bilder laden unter
`/admin/brand/…`, `POST /admin/api/auth/login` antwortet (400 bei falschen
Daten), `POST /api/auth/login` ist 404 – dieser Pfad gehört im Betrieb der
NestJS-API. `next build` (Backend und Website) und `nest build` laufen
durch, `tsc` ist in allen drei Apps sauber.

**Noch offen aus dieser Runde:** der Reverse Proxy selbst (nginx/Caddy oben)
ist dokumentiert, aber nirgends produktiv erprobt – die Pfad-Aufteilung
wurde lokal über die drei Ports simuliert, nicht über einen echten Proxy.
