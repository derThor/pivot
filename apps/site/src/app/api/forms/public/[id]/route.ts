const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Formular-Definition für den öffentlichen Renderer.
 *
 * Bewusst als Proxy und nicht direkt aus dem Browser: die API erlaubt per
 * `CORS_ORIGIN` genau EINE Herkunft (das Backend), ein Aufruf von der
 * Website aus würde blockiert. Serverseitig gibt es dieses Problem nicht –
 * und `API_URL` bleibt dabei im Server, statt im Browser zu landen.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`${API_URL}/forms/public/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return Response.json(
      { message: "Formular nicht verfügbar." },
      { status: res.status },
    );
  }
  return Response.json(await res.json());
}
