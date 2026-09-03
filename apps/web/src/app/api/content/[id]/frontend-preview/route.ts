import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildAuthCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/bff-proxy";
import { resolveSiteBaseUrl } from "@/lib/site-base-url";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Kurze Gültigkeit: das hier ist ein Blick auf die eigene Seite, kein
 * teilbarer Freigabe-Link (dafür gibt es Vorschau-Links unter
 * Seiten → Vorschau-Links, Standard 7 Tage). */
const PREVIEW_TTL_HOURS = 1;

/** Fehler mit Angabe des gescheiterten Schritts – ohne die stand im
 * Browser nur ein nackter Status, dem man nicht ansah, ob das Ausstellen
 * des Tokens oder das Auflösen der Seite schiefging. */
function fail(step: string, status: number, message?: string) {
  return NextResponse.json(
    { message: message ?? `Vorschau fehlgeschlagen (${step}).`, step },
    { status },
  );
}

/**
 * Öffnet eine Seite in der öffentlichen Website statt in der
 * Backend-Vorschau (Nutzervorgabe, 2026-09-02: "wenn ich bei seiten auf
 * vorschau klicke, soll die seite im frontend aufgerufen werden").
 *
 * Damit das auch für noch nicht veröffentlichte Seiten geht, ohne sie für
 * alle sichtbar zu machen ("da aber nur mit backendrecht bei vorschau"),
 * stellt diese Route einen kurzlebigen Vorschau-Token aus und hängt ihn an
 * die Frontend-URL. Das Ausstellen läuft über `POST
 * /content/:id/preview-links` und verlangt dort `preview-links:create` –
 * wer das Recht nicht hat, bekommt hier denselben Fehler durchgereicht.
 *
 * Den Ziel-Pfad liefert danach `GET /public/preview/:token` gleich mit
 * (`path`). Bewusst so, statt ihn hier aus `GET /content/:id` selbst zu
 * bauen: dessen Admin-Projektion liefert Kategorien als Join-Zeilen
 * (`{ category: { slug } }`, nicht `{ slug }`) – ein hier nachgebauter
 * Pfad wäre für jede Seite MIT Kategorie falsch gewesen. So gibt es genau
 * eine Stelle, die Pfade bildet (`buildContentPath()` im Backend).
 *
 * Als GET-Route umgesetzt, damit der Knopf ein einfacher
 * `<a target="_blank">` sein kann: ein `window.open()` nach einem `await`
 * wird von Browsern als Popup blockiert.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const resolved = await resolveAccessToken(cookieStore);
  if (!resolved) return fail("auth", 401, "Nicht angemeldet.");

  const linkRes = await fetch(`${API_URL}/content/${id}/preview-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolved.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresInHours: PREVIEW_TTL_HOURS }),
    cache: "no-store",
  });
  if (!linkRes.ok) {
    // Häufigster Fall: fehlendes `preview-links:create`. Die Meldung des
    // Backends bleibt erhalten, statt sie durch eine eigene zu ersetzen.
    const body = (await linkRes.json().catch(() => null)) as {
      message?: string;
    } | null;
    return fail("preview-link", linkRes.status, body?.message);
  }
  const { token } = (await linkRes.json()) as { token: string };

  const previewRes = await fetch(
    `${API_URL}/public/preview/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!previewRes.ok) return fail("resolve", previewRes.status);
  const preview = (await previewRes.json()) as {
    content: { path: string } | null;
  };
  if (!preview.content) {
    return fail("resolve", 404, "Seite nicht gefunden.");
  }

  const base = await resolveSiteBaseUrl(request);
  const target = `${base}${preview.content.path}?preview=${encodeURIComponent(token)}`;

  const response = NextResponse.redirect(target, 302);
  // Wurde das Zugriffstoken unterwegs über das Refresh-Cookie erneuert,
  // muss das auch im Browser ankommen – sonst erneuert der nächste Aufruf
  // erneut (gleiches Muster wie in `proxyToApi()`).
  if (resolved.refreshed) {
    for (const { name, value, options } of buildAuthCookies(
      resolved.refreshed,
    )) {
      response.cookies.set(name, value, options);
    }
  }
  return response;
}
