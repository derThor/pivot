"use client";

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
import { formatBytes, formatName } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function MediaPreviewDialog({ item }: { item: MediaItem }) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(item)}
          alt={item.alt ?? item.filename}
          className="aspect-[4/3] w-full object-cover transition-opacity hover:opacity-90"
        />
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(item)}
          alt={item.alt ?? item.filename}
          className="max-h-[65vh] w-full rounded-lg border object-contain"
        />
        {item.alt && (
          <p className="text-sm text-muted-foreground">
            Alt-Text: {item.alt}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
