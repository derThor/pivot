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

export function mediaTypeLabel(mimeType: string): string {
  switch (mediaCategory(mimeType)) {
    case "image":
      return "Bild";
    case "pdf":
      return "PDF-Dokument";
    case "video":
      return "Video";
    case "office":
      if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Excel-Tabelle";
      if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "PowerPoint-Präsentation";
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
