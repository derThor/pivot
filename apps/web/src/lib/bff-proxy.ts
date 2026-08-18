import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Gemeinsamer Kern für die BFF-Proxy-Routen der Datenschutz-Seite
 * (Nutzervorgabe, 2026-08-18) – bei ~20 fast identischen Routen (5 einfache
 * CRUD-Ressourcen + 4x Papierkorb-Unterrouten + Retention/Report) lohnt sich
 * die Bündelung, anders als bei den wenigen bestehenden Einzel-Routen
 * (company-locations etc.), die weiterhin je für sich hand-geschrieben
 * bleiben. */
export async function proxyToApi(
  method: string,
  path: string,
  body?: unknown,
): Promise<NextResponse> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  }

  const backendRes = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const contentType = backendRes.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    const text = await backendRes.text();
    return new NextResponse(text, {
      status: backendRes.status,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          backendRes.headers.get("content-disposition") ??
          'attachment; filename="bericht.csv"',
      },
    });
  }

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data, { status: backendRes.status });
}
