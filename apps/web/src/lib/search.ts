import {
  FileText,
  FolderTree,
  Image as ImageIcon,
  Link2,
  ShieldCheck,
  Tag as TagIcon,
  Users,
} from "lucide-react";

export type SearchResultType =
  | "content"
  | "category"
  | "tag"
  | "media"
  | "user"
  | "role"
  | "previewLink";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

export const searchTypeMeta: Record<
  SearchResultType,
  {
    label: string;
    icon: typeof FileText;
    href: string;
    badgeClassName: string;
  }
> = {
  content: {
    label: "Inhalt",
    icon: FileText,
    href: "/dashboard/content",
    badgeClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  },
  category: {
    label: "Kategorie",
    icon: FolderTree,
    href: "/dashboard/categories",
    badgeClassName:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
  },
  tag: {
    label: "Tag",
    icon: TagIcon,
    href: "/dashboard/tags",
    badgeClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  },
  media: {
    label: "Medium",
    icon: ImageIcon,
    href: "/dashboard/media",
    badgeClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  user: {
    label: "Benutzer",
    icon: Users,
    href: "/dashboard/users",
    badgeClassName:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
  },
  role: {
    label: "Rolle",
    icon: ShieldCheck,
    href: "/dashboard/roles",
    badgeClassName:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  previewLink: {
    label: "Vorschau-Link",
    icon: Link2,
    href: "/dashboard/content/preview-links",
    badgeClassName:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
  },
};

/**
 * Ermittelt für Nicht-Inhalte-Treffer (die keine eigene Detailseite
 * haben, nur eine per Dialog bearbeitbare Listen-Zeile/-Kachel), auf
 * welcher Seite der paginierten Liste der Treffer tatsächlich liegt –
 * sonst würde man immer auf Seite 1 landen und die Markierung liefe bei
 * größeren Listen ins Leere.
 */
async function locateResult(result: SearchResult, defaultPageSize: number) {
  const res = await fetch(
    `/api/search/locate?type=${result.type}&id=${result.id}&pageSize=${defaultPageSize}`,
  );
  const data = await res.json().catch(() => null);
  return data as { page?: number; folderId?: string | null } | null;
}

export async function searchResultHref(
  result: SearchResult,
  searchTerm: string,
  defaultPageSize: number,
) {
  // Inhalte haben eine eigene Detailseite (Editor) – dahin springt man
  // direkt, ohne Markierung. Alle anderen Bereiche werden nur per Dialog
  // auf ihrer Listen-Seite bearbeitet, dort wird stattdessen der
  // gesuchte Begriff im Treffer-Text markiert (siehe useHighlightParam)
  // und – bei Bedarf – zur richtigen Seite navigiert.
  if (result.type === "content") {
    return `/dashboard/content/${result.id}/edit`;
  }

  const location = await locateResult(result, defaultPageSize);
  const params = new URLSearchParams({ highlight: result.id, q: searchTerm });
  if (location?.page && location.page > 1) {
    params.set("page", String(location.page));
  }
  if (result.type === "media" && location?.folderId) {
    params.set("folder", location.folderId);
  }
  return `${searchTypeMeta[result.type].href}?${params.toString()}`;
}
