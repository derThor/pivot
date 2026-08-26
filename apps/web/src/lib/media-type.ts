import {
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";

export type MediaCategory = "image" | "pdf" | "video" | "office" | "other";

export const MEDIA_CATEGORY_LABELS: Record<MediaCategory, string> = {
  image: "Bild",
  pdf: "PDF",
  video: "Video",
  office: "Office-Dokument",
  other: "Sonstige",
};

// Muss mit ALLOWED_MIME_TYPES in apps/api/src/media/media.config.ts
// synchron gehalten werden.
export function mediaCategory(mimeType: string): MediaCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType.startsWith("application/vnd.openxmlformats-officedocument.")
  ) {
    return "office";
  }
  return "other";
}

function officeIcon(mimeType: string): LucideIcon {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return Presentation;
  }
  return FileText;
}

export function mediaTypeIcon(mimeType: string): LucideIcon {
  switch (mediaCategory(mimeType)) {
    case "image":
      return Image;
    case "pdf":
      return FileText;
    case "video":
      return Video;
    case "office":
      return officeIcon(mimeType);
    default:
      return File;
  }
}

/** Ist das SVG? Bewusst eine eigene Prüfung statt `mediaCategory()`
 * anzupassen: `mediaCategory()` zählt SVG absichtlich als `"image"`
 * (für den Bild-Picker im Seiten-Designer, wo eine echte Vorschau
 * gewünscht ist), nur die Medien-Übersicht zeigt SVG stattdessen als
 * farbige Icon-Kachel (Nutzervorgabe, 2026-08-17, 1:1 nach Bildvorlage
 * – ein Rohbild würde bei sehr breiten/schmalen SVGs das Masonry-Raster
 * verzerren, ein Icon nicht). */
export function isSvg(mimeType: string): boolean {
  return mimeType === "image/svg+xml";
}

// Extension aus dem Dateinamen statt aus dem MIME-Typ – knapper &
// lesbarer für die Kachel-Beschriftung ("DOCX" statt
// "vnd.openxmlformats-officedocument..."), Fallback auf eine grobe
// Ableitung aus dem MIME-Typ, falls der Dateiname keine Endung hat.
export function fileExtensionLabel(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop();
  if (ext && ext.length <= 5 && ext !== filename) return ext.toUpperCase();
  return mimeType.split("/")[1]?.toUpperCase() ?? "DATEI";
}

/** Farbige Kachel-Gestaltung für Nicht-Bild-Dateitypen in der Medien-
 * Übersicht (Nutzervorgabe, 2026-08-17, 1:1 nach Bildvorlage) – jede
 * Kategorie bekommt einen eigenen Pastellton für Hintergrund + Icon/
 * Text, damit Dateitypen auf einen Blick unterscheidbar sind, statt
 * alle in derselben grauen Box zu landen. */
export function mediaTypeStyle(mimeType: string): { bg: string; fg: string } {
  if (isSvg(mimeType)) return { bg: "bg-lime-50", fg: "text-lime-600" };
  if (mimeType === "application/pdf")
    return { bg: "bg-red-50", fg: "text-red-500" };
  if (mimeType.startsWith("video/"))
    return { bg: "bg-sky-50", fg: "text-sky-600" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return { bg: "bg-emerald-50", fg: "text-emerald-600" };
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return { bg: "bg-orange-50", fg: "text-orange-600" };
  }
  if (
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml")
  ) {
    return { bg: "bg-blue-50", fg: "text-blue-600" };
  }
  return { bg: "bg-muted/50", fg: "text-muted-foreground" };
}

export function mediaTypeLabel(mimeType: string): string {
  if (isSvg(mimeType)) return "SVG";
  switch (mediaCategory(mimeType)) {
    case "image":
      return "Bild";
    case "pdf":
      return "PDF-Dokument";
    case "video":
      return "Video";
    case "office":
      if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
        return "Excel-Tabelle";
      if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
        return "PowerPoint-Präsentation";
      return "Word-Dokument";
    default:
      return "Datei";
  }
}

// Für <input accept="...">-Attribute – synchron mit
// apps/api/src/media/media.config.ts ALLOWED_MIME_TYPES.
export const ACCEPTED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
].join(",");

export const ACCEPTED_IMAGE_MIME_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";

export const ACCEPTED_VIDEO_MIME_TYPES = "video/mp4,video/webm,video/quicktime";
