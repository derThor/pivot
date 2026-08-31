const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

// Eigenständige Kopie von apps/web/src/lib/media.ts' `resolveImageSrc()` –
// gleicher Grund wie bei cn.ts (keine Rückwärts-Abhängigkeit auf die App).
// Ein data:/http(s):-Wert (eingebettetes Dummy-Bild bzw. bereits absolute
// URL) darf nicht zusätzlich mit API_ORIGIN verkettet werden.
export function resolveImageSrc(url: string) {
  if (/^(data:|https?:)/.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}
