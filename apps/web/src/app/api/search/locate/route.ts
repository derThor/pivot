import { NextResponse } from "next/server";
import { proxyToApi } from "@/lib/bff-proxy";

// Bildet einen globalen Such-Treffertyp auf den passenden
// "auf welcher Seite liegt dieser Eintrag"-Endpoint im Backend ab. Nur für
// Bereiche ohne eigene Detailseite (siehe searchResultHref in lib/search.ts
// – content/user/form/gallery springen direkt dorthin, kommen hier also
// nie an).
const backendPath: Record<string, (id: string) => string> = {
  category: (id) => `/categories/${id}/page`,
  tag: (id) => `/tags/${id}/page`,
  media: (id) => `/media/${id}/page`,
  role: (id) => `/roles/${id}/page`,
  previewLink: (id) => `/content/preview-links/${id}/page`,
  faq: (id) => `/global-modules/${id}/page`,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const id = searchParams.get("id");
  const pageSize = searchParams.get("pageSize") ?? "10";

  const buildPath = backendPath[type];
  if (!buildPath || !id) {
    return NextResponse.json(
      { message: "Ungültige Anfrage." },
      { status: 400 },
    );
  }

  return proxyToApi(
    "GET",
    `${buildPath(id)}?pageSize=${encodeURIComponent(pageSize)}`,
  );
}
