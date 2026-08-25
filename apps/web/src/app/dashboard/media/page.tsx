import { FolderDialog } from "@/components/folder-dialog";
import { MediaExplorer } from "@/components/media-explorer";
import { MediaFilters } from "@/components/media-filters";
import { MediaUploadDialog } from "@/components/media-upload-dialog";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { StorageQuotaBanner } from "@/components/storage-quota-banner";
import {
  getMediaCounts,
  getMediaFolders,
  getMediaList,
  getMediaStorageUsage,
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
  const {
    folder,
    page: pageParam,
    type,
    minSize,
    maxSize,
    tags,
    unused,
  } = await searchParams;
  const currentFolderId = folder ?? null;
  const page = Number(pageParam) || 1;
  const tagIds = tags ? tags.split(",").filter(Boolean) : undefined;
  const showUnusedOnly = unused === "true";

  const [folders, settings, tagList, storageUsage, mediaCounts] =
    await Promise.all([
      getMediaFolders(),
      getPublicSettings(),
      getTags({ pageSize: 100 }),
      getMediaStorageUsage(),
      getMediaCounts(currentFolderId),
    ]);

  const unusedMedia = showUnusedOnly
    ? await getUnusedMedia({ page, pageSize: settings?.defaultPageSize ?? 10 })
    : null;
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
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Medien" />
        <div className="flex flex-wrap gap-2">
          <FolderDialog parentId={currentFolderId} />
          <MediaUploadDialog
            folders={folders ?? []}
            defaultFolderId={currentFolderId}
          />
        </div>
      </div>

      <PageContent plain>
        <StorageQuotaBanner usage={storageUsage} />

        <MediaFilters
          tags={tagList?.items ?? []}
          counts={mediaCounts ?? null}
        />

        {showUnusedOnly ? (
          <>
            <p className="text-sm text-muted-foreground">
              {unusedMedia?.meta.total ?? 0} Medien, die in keinem aktiven
              Inhalt, SEO-Bild oder Logo referenziert werden –
              ordnerübergreifend.
            </p>
            <MediaExplorer
              items={unusedMedia?.items ?? []}
              folders={folders ?? []}
              availableTags={tagList?.items ?? []}
              currentFolderId={null}
              hideFolders
            />
            {unusedMedia && (
              <PaginationControls
                page={unusedMedia.meta.page}
                pageCount={unusedMedia.meta.pageCount}
                buildHref={(p) => `?unused=true&page=${p}`}
              />
            )}
          </>
        ) : (
          <>
            <MediaExplorer
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
      </PageContent>
    </div>
  );
}
