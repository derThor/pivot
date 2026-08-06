import Link from "next/link";
import { ChevronRight, Folder, FolderTree, Home, Image } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FolderTileMenu } from "@/components/folder-tile-menu";
import { MediaGrid } from "@/components/media-grid";
import { getFolderBreadcrumb, getFolderChildren } from "@/lib/media-folders";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

export function MediaFolderBrowser({
  folders,
  currentFolderId,
  items,
}: {
  folders: MediaFolder[];
  currentFolderId: string | null;
  items: MediaItem[];
}) {
  const breadcrumb = getFolderBreadcrumb(folders, currentFolderId);
  const children = getFolderChildren(folders, currentFolderId);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/dashboard/media"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="size-4" />
          Medien
        </Link>
        {breadcrumb.map((folder) => (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link
              href={`/dashboard/media?folder=${folder.id}`}
              className={
                folder.id === currentFolderId
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }
              aria-current={folder.id === currentFolderId ? "page" : undefined}
            >
              {folder.name}
            </Link>
          </span>
        ))}
      </nav>

      {children.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {children.map((folder) => (
            <div
              key={folder.id}
              className="flex items-start justify-between gap-1 rounded-2xl bg-card p-4 shadow-card"
            >
              <Link
                href={`/dashboard/media?folder=${folder.id}`}
                className="flex min-w-0 flex-1 flex-col gap-1"
              >
                <span className="flex items-center gap-2">
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {folder.name}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary">
                    <Image />
                    {folder.mediaCount}
                  </Badge>
                  {folder.childCount > 0 && (
                    <Badge variant="secondary">
                      <FolderTree />
                      {folder.childCount}
                    </Badge>
                  )}
                </span>
              </Link>
              <div className="flex shrink-0">
                <FolderTileMenu folder={folder} />
              </div>
            </div>
          ))}
        </div>
      )}

      <MediaGrid items={items} folders={folders} />
    </div>
  );
}
