# Medien-Vorschau-Popup

**Datum:** 2026-08-02
**Betroffene Bereiche:** apps/web (`src/components/media-preview-dialog.tsx`,
`src/lib/media.ts`)

## Was wurde gebaut

- `MediaPreviewDialog`: Klick auf das Grid-Thumbnail in `/dashboard/media`
  öffnet einen `Dialog` mit größerem Bild (`object-contain`, max. 65vh
  Höhe) sowie Metadaten (Dateiname, MIME-Type, Größe, Uploader, Datum,
  Alt-Text).
- Neues, bewusst schlankes Modul `src/lib/media.ts` mit `mediaUrl()` –
  ausgelagert aus `lib/api-server.ts` (siehe Stolpersteine).
- Neue öffentliche Env-Variable `NEXT_PUBLIC_API_ORIGIN` (Default
  `http://localhost:3001`) in `.env.local`/`.env.example`.

## Warum diese Lösung

- **`mediaUrl()` in ein eigenes, von `next/headers` unabhängiges Modul
  verschoben**: `lib/api-server.ts` importiert `cookies` aus
  `next/headers` (server-only API). Die neue `MediaPreviewDialog` ist aber
  eine Client-Komponente (braucht `useState` für den Dialog-Open-State).
  Ein Value-Import von `mediaUrl` aus `api-server.ts` in eine
  Client-Komponente lässt Next.js/Turbopack den kompletten Modulgraphen
  inkl. `next/headers`-Abhängigkeit ins Client-Bundle ziehen wollen → harter
  Build-Fehler ("You're importing a module that depends on
  'next/headers' ... in the Pages Router"). Typen-Importe
  (`import type { MediaItem }`) sind davon nicht betroffen, werden von
  TypeScript vollständig wegoptimiert – nur Value-Importe wie `mediaUrl`
  mussten raus.
- **`NEXT_PUBLIC_API_ORIGIN` statt den bestehenden (server-only)
  `API_URL` weiterzuverwenden**: `process.env.API_URL` ist im
  Browser-Bundle nicht verfügbar (Next.js exponiert nur
  `NEXT_PUBLIC_*`-Variablen client-seitig). Der ursprüngliche Ansatz hätte
  serverseitig zufällig funktioniert (SSR liest echte Server-Env, Fallback
  zufällig identisch mit dem lokalen Dev-Wert), wäre aber bei jedem erneuten
  Client-seitigen Rendern (z.B. durch einen State-Wechsel ausgelöst) auf den
  hartkodierten Fallback zurückgefallen – in jeder Umgebung, in der die
  echte API-Origin vom lokalen Default abweicht, ein stiller Bug mit
  falschen Bild-URLs nach der ersten Interaktion.

## Stolpersteine / Besonderheiten

- **Client-Komponenten dürfen keine Value-Importe aus Modulen mit
  `next/headers`/`next/cookies`-Abhängigkeit haben**, auch nicht
  transitiv über eine gemeinsame Utility-Datei. Faustregel für dieses
  Projekt: alles, was sowohl von Server Components (`lib/api-server.ts`)
  als auch von Client Components gebraucht wird, gehört in ein eigenes,
  garantiert "clientsicheres" Modul (keine `next/headers`-Importe, keine
  `"use server"`-Direktiven) – hier `lib/media.ts`, nach demselben Prinzip
  wie `lib/utils.ts` (`cn`, `slugify`, `formatBytes`).

## Relevante Dateien

- `apps/web/src/components/media-preview-dialog.tsx`
- `apps/web/src/lib/media.ts`
- `apps/web/src/app/dashboard/media/page.tsx`
- `apps/web/.env.local`, `apps/web/.env.example`

## Offene Punkte

- Keine Navigation zwischen Medien innerhalb des Vorschau-Dialogs
  (vor/zurück) – aktuell schließt man und klickt das nächste Thumbnail an.
