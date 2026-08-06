import type { MediaFolder } from "@/lib/api-server";

export function getFolderChildren(
  folders: MediaFolder[],
  parentId: string | null,
) {
  return folders.filter((folder) => folder.parentId === parentId);
}

export function getFolderBreadcrumb(
  folders: MediaFolder[],
  currentId: string | null,
): MediaFolder[] {
  const path: MediaFolder[] = [];
  let id = currentId;
  while (id) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

/** Für Ordner-Auswahllisten: alle Ordner mit Einrückung nach Tiefe. */
export function getIndentedFolderOptions(folders: MediaFolder[]) {
  const options: { id: string; label: string }[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const folder of getFolderChildren(folders, parentId)) {
      options.push({
        id: folder.id,
        label: `${"— ".repeat(depth)}${folder.name}`,
      });
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  return options;
}
