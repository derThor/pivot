"use client";

import { createElement } from "react";
import { Download } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";
import { mediaCategory, mediaTypeIcon, mediaTypeLabel } from "@/lib/media-type";
import { formatBytes, formatName } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function PreviewContent({ item }: { item: MediaItem }) {
  const category = mediaCategory(item.mimeType);

  if (category === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl(item)}
        alt={item.alt ?? item.filename}
        className="max-h-[65vh] w-full rounded-lg border object-contain"
      />
    );
  }

  if (category === "pdf") {
    return (
      <iframe
        src={mediaUrl(item)}
        title={item.filename}
        className="h-[70vh] w-full rounded-lg border"
      />
    );
  }

  if (category === "video") {
    return (
      <video
        controls
        src={mediaUrl(item)}
        className="max-h-[65vh] w-full rounded-lg border"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12">
      {createElement(mediaTypeIcon(item.mimeType), {
        className: "size-12 text-muted-foreground",
      })}
      <span className="text-sm font-medium">{mediaTypeLabel(item.mimeType)}</span>
      <a
        href={mediaUrl(item)}
        download
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Download className="size-4" />
        Datei herunterladen
      </a>
    </div>
  );
}

export function MediaPreviewDialog({ item }: { item: MediaItem }) {
  const category = mediaCategory(item.mimeType);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="block w-full cursor-zoom-in"
            aria-label={`${item.filename} in groß ansehen`}
          />
        }
      >
        {category === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl({ url: item.thumbnailUrl ?? item.url })}
            alt={item.alt ?? item.filename}
            className="aspect-square w-full object-cover transition-opacity hover:opacity-90"
          />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-muted/50 transition-opacity hover:opacity-90">
            {createElement(mediaTypeIcon(item.mimeType), {
              className: "size-8 text-muted-foreground",
            })}
            <span className="text-xs text-muted-foreground">
              {mediaTypeLabel(item.mimeType)}
            </span>
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{item.filename}</DialogTitle>
          <DialogDescription>
            {item.mimeType} · {formatBytes(item.size)} · hochgeladen von{" "}
            {formatName(item.uploadedBy)} am{" "}
            {dateFormatter.format(new Date(item.createdAt))}
          </DialogDescription>
        </DialogHeader>
        <PreviewContent item={item} />
        {item.alt && (
          <p className="text-sm text-muted-foreground">
            Alt-Text: {item.alt}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
