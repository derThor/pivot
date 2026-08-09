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

// Muss mit RASTER_MIME_TYPES in apps/api/src/media/media-image-processing.service.ts
// synchron gehalten werden – nur diese Typen laufen durch die Verarbeitungs-
// Pipeline (Zuschneiden/Fokuspunkt setzen daher hier ebenfalls voraus).
const CROPPABLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isCroppableImage(mimeType: string) {
  return CROPPABLE_MIME_TYPES.has(mimeType);
}
