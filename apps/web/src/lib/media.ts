const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

export function mediaUrl(item: { url: string }) {
  return `${API_ORIGIN}${item.url}`;
}

// Für Bild-Felder, die auch mit einem eingebetteten Dummy-Bild
// (`data:image/...`, siehe Modul-Bibliothek im Seiten-Designer) statt
// einer von der Medien-API gelieferten relativen URL vorbefüllt sein
// können – ein data:/http(s):-Wert darf nicht zusätzlich mit API_ORIGIN
// verkettet werden.
export function resolveImageSrc(url: string) {
  if (/^(data:|https?:)/.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}
