import type { TemplateManifest } from "@pivot/blocks";

import { proxyToApi } from "@/lib/bff-proxy";
import { resolveSiteBaseUrl } from "@/lib/site-base-url";

/**
 * Das WIRKSAME Manifest dieser Installation – und unter welchem Schlüssel
 * seine Werte liegen.
 *
 * Rangfolge, dieselbe wie auf der Website (layout.tsx):
 * 1. das aktive, hochgeladene Template (Einstellungen → Frontend),
 * 2. sonst die Manifest-Datei des Frontend-Projekts.
 *
 * Ein in den Einstellungen hinterlegtes Manifest steht bewusst NICHT
 * hier: das hält das Formular selbst und reicht es als Übersteuerung
 * herein – sonst müsste diese Route den ungespeicherten Stand kennen.
 *
 * **Kein Manifest ist kein Fehler:** läuft die Website nicht oder bringt
 * ihr Template keins mit, kommt `{ manifest: null }` mit Status 200. Die
 * Oberfläche zeigt dann einen Hinweis, der Rest bleibt bedienbar.
 */
export async function GET(request: Request) {
  // Aktives Paket zuerst – es sticht die Datei des Projekts.
  try {
    const res = await proxyToApi("GET", "/frontend-templates");
    if (res.ok) {
      const items = (await res.json()) as {
        key: string;
        name: string;
        manifest: TemplateManifest;
        isActive: boolean;
      }[];
      const active = items.find((item) => item.isActive);
      if (active) {
        return Response.json({
          manifest: active.manifest,
          templateKey: active.key,
          source: "upload",
        });
      }
    }
  } catch {
    // Kein aktives Paket ermittelbar – dann gilt die Datei des Projekts.
  }

  const base = await resolveSiteBaseUrl(request);
  try {
    const res = await fetch(`${base}/api/template`, { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ manifest: null, reason: res.status });
    }
    const manifest = (await res.json()) as TemplateManifest;
    return Response.json({
      manifest,
      // Werte des eingebauten Templates liegen unter diesem Schlüssel,
      // siehe BUILTIN_TEMPLATE_KEY in @pivot/blocks.
      templateKey: "__builtin",
      source: "code",
    });
  } catch {
    return Response.json({ manifest: null, reason: "unreachable" });
  }
}
