import { proxyToApi } from "@/lib/bff-proxy";

/** Zurück auf das im Frontend-Projekt eingebaute Template. */
export async function POST() {
  return proxyToApi("POST", "/frontend-templates/deactivate");
}
