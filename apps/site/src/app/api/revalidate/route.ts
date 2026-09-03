import { revalidatePath } from "next/cache";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Berechtigung, die ein MENSCH zum Leeren des Frontend-Caches braucht –
 * dieselbe wie für jede andere Einstellung. */
const REQUIRED_PERMISSION = "settings:update";

/** Ist der Aufrufer ein angemeldeter Mensch mit `settings:update`? Das ist
 * der Weg des Knopfes „Frontend-Cache leeren" in der Administration. */
async function isAuthorizedUser(authorization: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const me = (await res.json()) as { permissions?: string[] };
  return me.permissions?.includes(REQUIRED_PERMISSION) ?? false;
}

/** Oder ist es die API selbst, weil sich ein Inhalt geändert hat? Sie
 * stellt sich dafür ein kurzlebiges Token aus, dessen Signatur nur sie
 * prüfen kann (symmetrischer Schlüssel) – deshalb der Rückweg. */
async function isAuthorizedSystem(token: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/public/revalidation-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { valid?: boolean };
  return body.valid === true;
}

/**
 * Verwirft den gesamten Zwischenspeicher dieser Website
 * (`revalidatePath("/", "layout")`) – gerenderte Seiten wie API-Antworten.
 *
 * Zwei zugelassene Aufrufer, beide ohne ein gemeinsames Geheimnis in der
 * Umgebung (Begründung siehe knowledge-base/platform/caching.md):
 *
 * 1. Ein Mensch über den Knopf unter Einstellungen → Caching. Die
 *    Administration reicht sein Zugriffstoken durch, hier wird es der API
 *    vorgelegt.
 * 2. Die API selbst, sobald sich etwas Veröffentlichtes geändert hat
 *    (SiteCacheService). Ihr Token trägt eine Zweck-Marke und lebt eine
 *    Minute.
 *
 * Beide Wege laufen über denselben `Authorization: Bearer`-Kopf; welcher
 * es ist, entscheidet schlicht, welche Prüfung zuerst zusagt.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ message: "Nicht angemeldet." }, { status: 401 });
  }
  const token = authorization.slice("Bearer ".length);

  const allowed =
    (await isAuthorizedSystem(token)) ||
    (await isAuthorizedUser(authorization));
  if (!allowed) {
    return Response.json(
      { message: "Keine Berechtigung, den Cache zu leeren." },
      { status: 403 },
    );
  }

  // "layout" statt "page": erfasst den gesamten Baum unterhalb von "/",
  // also auch Kategorie-Archive und Beiträge. Ein seitenweises Leeren gibt
  // es bewusst nicht – bei dieser Größe wäre die Buchhaltung, welcher
  // Pfad von welcher Änderung betroffen ist, mehr Fehlerquelle als Gewinn.
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
