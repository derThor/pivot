import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildAuthCookies } from "@/lib/auth";
import { resolveAccessToken } from "@/lib/bff-proxy";
import { resolveSiteBaseUrl } from "@/lib/site-base-url";

/**
 * "Frontend-Cache leeren" (Einstellungen → Caching, Nutzervorgabe
 * 2026-09-03). Anders als der Backend-Knopf geht das nicht an die API,
 * sondern an die öffentliche Website: nur der Next.js-Prozess von
 * `apps/site` kennt seinen eigenen Zwischenspeicher und kann ihn verwerfen
 * (`revalidatePath`, siehe apps/site/src/app/api/revalidate/route.ts).
 *
 * Das Zugriffstoken des angemeldeten Nutzers wird durchgereicht; die
 * Gegenseite prüft damit über `GET /auth/me`, ob `settings:update`
 * vorliegt. Dadurch braucht es kein gemeinsames Geheimnis in der
 * Umgebung beider Anwendungen.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const resolved = await resolveAccessToken(cookieStore);
  if (!resolved) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const base = await resolveSiteBaseUrl(request);
  let siteRes: Response;
  try {
    siteRes = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${resolved.accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Häufigster Fall in der Entwicklung: die Website läuft gerade nicht.
    // Die Adresse gehört in die Meldung, sonst rätselt man, welche
    // Installation überhaupt gemeint war.
    return NextResponse.json(
      { message: `Webseite unter ${base} nicht erreichbar.` },
      { status: 502 },
    );
  }

  if (!siteRes.ok) {
    const body = (await siteRes.json().catch(() => null)) as {
      message?: string;
    } | null;
    return NextResponse.json(
      {
        message: body?.message ?? "Frontend-Cache konnte nicht geleert werden.",
      },
      { status: siteRes.status },
    );
  }

  const response = NextResponse.json({ ok: true, target: base });
  // Wurde das Zugriffstoken unterwegs erneuert, muss das auch im Browser
  // ankommen (gleiches Muster wie in `proxyToApi()`).
  if (resolved.refreshed) {
    for (const { name, value, options } of buildAuthCookies(
      resolved.refreshed,
    )) {
      response.cookies.set(name, value, options);
    }
  }
  return response;
}
