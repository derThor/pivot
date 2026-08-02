const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

export function mediaUrl(item: { url: string }) {
  return `${API_ORIGIN}${item.url}`;
}
