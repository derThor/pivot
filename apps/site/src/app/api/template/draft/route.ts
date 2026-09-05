import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildManifestDraft } from "@pivot/blocks";

import { templateManifest } from "@/template/manifest";

/**
 * Erzeugt aus der CSS DIESES Templates einen Manifest-Entwurf – der
 * Generator, der beim Anlegen eines neuen Templates die stumpfe Arbeit
 * abnimmt (Nutzerentscheidung, 2026-09-05).
 *
 * **Warum die Website ihn ausliefert:** nur sie hat ihre eigene
 * `globals.css`. Gelesen wird die QUELLDATEI, nicht das gebaute
 * Stylesheet – im Gebauten sind die Tokens bereits in CSS-Regeln
 * aufgelöst und nicht mehr als Liste erkennbar.
 *
 * Folge: in einer Standalone-Auslieferung ohne Quellen schlägt das Lesen
 * fehl. Das ist kein Problem, sondern der Normalfall – ein Manifest baut
 * man in der Entwicklung, nicht auf dem Produktivserver. Die Antwort sagt
 * das dann klar, statt zu scheitern.
 */
export async function GET() {
  const file = path.join(process.cwd(), "src", "app", "globals.css");
  let css: string;
  try {
    css = await readFile(file, "utf8");
  } catch {
    return Response.json({
      draft: null,
      reason:
        "Die Quelldatei globals.css ist hier nicht lesbar. Der Entwurf lässt sich nur dort erzeugen, wo die Website aus ihren Quellen läuft (Entwicklung).",
    });
  }
  const { manifest, skipped } = buildManifestDraft(css, templateManifest.name);
  return Response.json({ draft: manifest, skipped });
}
