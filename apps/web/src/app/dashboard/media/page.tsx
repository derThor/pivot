import { FolderDialog } from "@/components/folder-dialog";
import { MediaFilters } from "@/components/media-filters";
import { MediaFolderBrowser } from "@/components/media-folder-browser";
import { MediaGrid } from "@/components/media-grid";
import { MediaUploadDialog } from "@/components/media-upload-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import {
  getMediaFolders,
  getMediaList,
  getPublicSettings,
  getTags,
  getUnusedMedia,
} from "@/lib/api-server";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    folder?: string;
    page?: string;
    type?: string;
    minSize?: string;
    maxSize?: string;
    tags?: string;
    unused?: string;
  }>;
}) {
  const { folder, page: pageParam, type, minSize, maxSize, tags, unused } =
    await searchParams;
  const currentFolderId = folder ?? null;
  const page = Number(pageParam) || 1;
  const tagIds = tags ? tags.split(",").filter(Boolean) : undefined;
  const showUnusedOnly = unused === "true";

  const [folders, settings, tagList] = await Promise.all([
    getMediaFolders(),
    getPublicSettings(),
    getTags({ pageSize: 100 }),
  ]);

  const unusedMedia = showUnusedOnly ? await getUnusedMedia() : null;
  const media = showUnusedOnly
    ? null
    : await getMediaList({
        page,
        pageSize: settings?.defaultPageSize ?? 10,
        folderId: currentFolderId ?? "root",
        type,
        minSize: minSize ? Number(minSize) : undefined,
        maxSize: maxSize ? Number(maxSize) : undefined,
        tagIds,
      });

  const extraParams = new URLSearchParams();
  if (type) extraParams.set("type", type);
  if (minSize) extraParams.set("minSize", minSize);
  if (maxSize) extraParams.set("maxSize", maxSize);
  if (tags) extraParams.set("tags", tags);
  const extraQuery = extraParams.toString() ? `&${extraParams.toString()}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medien</h1>
          <p className="text-sm text-muted-foreground">
            Bilder und Dateien deines CMS.
          </p>
        </div>
        <div className="flex gap-2">
          <FolderDialog parentId={currentFolderId} />
          <MediaUploadDialog
            folders={folders ?? []}
            defaultFolderId={currentFolderId}
          />
        </div>
      </div>

      <MediaFilters tags={tagList?.items ?? []} />

      {showUnusedOnly ? (
        <>
          <p className="text-sm text-muted-foreground">
            {unusedMedia?.items.length ?? 0} Medien, die in keinem aktiven
            Inhalt, SEO-Bild oder Logo referenziert werden – ordnerübergreifend.
          </p>
          <MediaGrid items={unusedMedia?.items ?? []} folders={folders ?? []} />
        </>
      ) : (
        <>
          <MediaFolderBrowser
            folders={folders ?? []}
            currentFolderId={currentFolderId}
            items={media?.items ?? []}
            availableTags={tagList?.items ?? []}
          />

          {media && (
            <PaginationControls
              page={media.meta.page}
              pageCount={media.meta.pageCount}
              buildHref={(p) =>
                currentFolderId
                  ? `?folder=${currentFolderId}&page=${p}${extraQuery}`
                  : `?page=${p}${extraQuery}`
              }
            />
          )}
        </>
      )}
    </div>
  );
}
