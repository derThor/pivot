const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Selbstauskunft aus dem Formular-Footer (Nutzervorgabe, 2026-09-02).
 *
 * Wie bei den Formular-Routen daneben ein Proxy statt eines direkten
 * Aufrufs aus dem Browser: die API lässt per `CORS_ORIGIN` nur eine
 * Herkunft zu (die Administration), ein Fetch von der Website aus würde
 * am CORS-Check scheitern.
 *
 * Die Besucher-IP wird bewusst NICHT weitergereicht: die Drosselung der
 * API greift hier absichtlich über die Server-IP, also für die ganze
 * Website gemeinsam. Eine Auskunftsanfrage ist ein seltener Vorgang – und
 * eine Betroffenenanfrage ist der letzte Ort, an dem wir eine IP-Adresse
 * mehr speichern wollen als nötig. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    note?: unknown;
  } | null;

  const res = await fetch(`${API_URL}/deletion-requests/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: typeof body?.email === "string" ? body.email : "",
      ...(typeof body?.note === "string" && body.note.trim()
        ? { note: body.note.trim() }
        : {}),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Nach außen bewusst nur zwei unterscheidbare Fälle: zu viele
    // Versuche oder "hat nicht geklappt". Alles Weitere wäre eine Aussage
    // darüber, was auf dem Server passiert ist.
    return Response.json(
      {
        message:
          res.status === 429
            ? "Zu viele Anfragen. Bitte versuchen Sie es später erneut."
            : "Ihre Anfrage konnte nicht aufgenommen werden. Bitte versuchen Sie es später erneut.",
      },
      { status: res.status === 429 ? 429 : 502 },
    );
  }

  return Response.json({ ok: true });
}
