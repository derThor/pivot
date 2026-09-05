import { proxyToApi } from "@/lib/bff-proxy";

/** Liste der hochgeladenen Frontend-Templates und Upload eines Pakets.
 * Der Upload geht als FormData durch – `proxyToApi` reicht sie
 * unverändert weiter (gleicher Weg wie beim Medien-Upload). */
export async function GET() {
  return proxyToApi("GET", "/frontend-templates");
}

export async function POST(request: Request) {
  const form = await request.formData();
  return proxyToApi("POST", "/frontend-templates", form);
}
