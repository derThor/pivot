import { templateManifest } from "@/template/manifest";

/**
 * Das Manifest dieses Templates als JSON – die Selbstbeschreibung, aus der
 * die Verwaltung ihre Frontend-Einstellungen baut (siehe
 * `packages/blocks/src/template-manifest.ts`).
 *
 * **Warum die Website es ausliefert und nicht die API:** das Manifest
 * gehört zum Template und liegt in dessen Code – nur die Website kennt
 * es. Die API würde es sonst spiegeln müssen, und dann gäbe es zwei
 * Wahrheiten, die auseinanderlaufen können.
 *
 * **Warum öffentlich:** es enthält ausschließlich Gestaltungsvorgaben
 * (Feldnamen, Beschriftungen, Vorgabewerte) – dieselbe Art Information,
 * die jeder aus dem ausgelieferten CSS ablesen kann. Eine Anmeldung wäre
 * hier eine Hürde ohne Schutzwirkung, und die Verwaltung müsste ein Token
 * an ein fremdes System reichen.
 *
 * `force-static`: die Datei ändert sich nur mit einem Deploy des
 * Frontends, nicht zur Laufzeit.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(templateManifest);
}
