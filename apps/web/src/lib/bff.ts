/** Präfix der Backend-App. Das Backend läuft unter einem Pfad derselben
 * Domain wie die öffentliche Website (`https://kunde.de/admin`), gesetzt
 * über `basePath` in `next.config.ts` – siehe
 * knowledge-base/platform/deployment.md.
 *
 * Next.js hängt `basePath` automatisch an `<Link>`, den Router und die
 * eigenen Assets, **nicht** aber an `fetch()`-URLs, `sendBeacon()` oder
 * rohe `<a href>`/`<img src>`-Attribute. Genau dafür ist dieser Helfer da:
 * jeder Aufruf einer BFF-Route im Browser läuft über `bff("/api/…")`.
 *
 * `NEXT_PUBLIC_BASE_PATH=""` schaltet das Präfix ab – für den Betrieb auf
 * einer eigenen (Sub-)Domain, dann ohne jede weitere Codeänderung. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/admin";

/** Macht aus einem app-internen Pfad einen browser-tauglichen Pfad mit
 * `basePath`-Präfix. */
export function bff(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Gleiches Präfix für statische Dateien aus `public/` und für rohe
 * Browser-Navigationen (`window.location.assign(...)`) – beides umgeht
 * Next.js' automatische `basePath`-Behandlung genauso wie `fetch()`.
 * `<Link>`, `useRouter()` und `next/image` brauchen das **nicht**, die
 * setzen den `basePath` selbst. */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
