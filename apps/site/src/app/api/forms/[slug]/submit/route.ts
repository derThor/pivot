const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Absenden eines öffentlichen Formulars (siehe Kommentar in
 * ../public/[id]/route.ts, warum das über den Server läuft).
 *
 * Wichtig: `x-forwarded-for` wird durchgereicht. Die API ermittelt daraus
 * die Absender-IP (`clientIp(req)`, gespeichert nur wenn die
 * Datenschutz-Einstellung das erlaubt) – ohne Weiterreichen stünde dort
 * die IP dieses Servers statt die des Besuchers, was den Wert wertlos und
 * die gespeicherte Angabe schlicht falsch machen würde.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  const forwardedFor =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    undefined;

  const res = await fetch(
    `${API_URL}/forms/${encodeURIComponent(slug)}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(forwardedFor && { "x-forwarded-for": forwardedFor }),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const data = await res.json().catch(() => null);
  return Response.json(data ?? { message: "Senden fehlgeschlagen." }, {
    status: res.status,
  });
}
