import Link from "next/link";
import { ChevronRight, Folder, FolderTree, Home, Image } from "lucide-react";

import { FolderTileMenu } from "@/components/folder-tile-menu";
import { MediaGrid } from "@/components/media-grid";
import { getFolderBreadcrumb, getFolderChildren } from "@/lib/media-folders";
import type { MediaFolder, MediaItem, TaxonomyItem } from "@/lib/api-server";

export function MediaFolderBrowser({
  folders,
  currentFolderId,
  items,
  availableTags = [],
}: {
  folders: MediaFolder[];
  currentFolderId: string | null;
  items: MediaItem[];
  availableTags?: TaxonomyItem[];
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
        <div className="mb-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {children.map((folder) => (
            <div key={folder.id} className="flex flex-col items-center gap-2">
              <div className="relative">
                <Link
                  href={`/dashboard/media?folder=${folder.id}`}
                  className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-card"
                >
                  <Folder
                    className="size-10 text-white"
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                </Link>
                <div className="absolute -top-2 -right-2">
                  <FolderTileMenu folder={folder} />
                </div>
                {folder.mediaCount > 0 && (
                  <span className="absolute -bottom-2 -left-2 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border-2 border-background bg-secondary px-1.5 text-[10px] font-semibold text-secondary-foreground">
                    <Image className="size-3" />
                    {folder.mediaCount}
                  </span>
                )}
                {folder.childCount > 0 && (
                  <span className="absolute -bottom-2 -right-2 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border-2 border-background bg-secondary px-1.5 text-[10px] font-semibold text-secondary-foreground">
                    <FolderTree className="size-3" />
                    {folder.childCount}
                  </span>
                )}
              </div>
              <Link
                href={`/dashboard/media?folder=${folder.id}`}
                className="max-w-full truncate text-sm font-medium"
                title={folder.name}
              >
                {folder.name}
              </Link>
            </div>
          ))}
        </div>
      )}

      <MediaGrid items={items} folders={folders} availableTags={availableTags} />
    </div>
  );
}
