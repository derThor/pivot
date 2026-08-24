import {
  ClipboardList,
  FileText,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Images,
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
  | "previewLink"
  | "faq"
  | "gallery"
  | "form";

export const ALL_SEARCH_RESULT_TYPES: readonly SearchResultType[] = [
  "content",
  "faq",
  "gallery",
  "form",
  "category",
  "tag",
  "media",
  "user",
  "role",
  "previewLink",
];

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

/** Antwort von `GET /search/paged` – ein einzelner Bereich mit
 * Gesamtzahl, für die Pagination auf der Detailsuche-Ergebnisseite. */
export interface PagedSearchResult {
  items: SearchResult[];
  total: number;
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
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    href: "/dashboard/content/faqs",
    badgeClassName:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  },
  gallery: {
    label: "Galerie",
    icon: Images,
    href: "/dashboard/content/galleries",
    badgeClassName:
      "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
  },
  form: {
    label: "Formular",
    icon: ClipboardList,
    href: "/dashboard/forms",
    badgeClassName:
      "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
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
  // Inhalte ("Seiten") haben eine eigene Detailseite (Editor) – dahin
  // springt man direkt, ohne Markierung. Bereiche ohne eigene Detailseite
  // (FAQ, Kategorien, Tags, Medien, Rollen, Vorschau-Links – nur per
  // Dialog auf ihrer Listen-Seite bearbeitbar) markieren stattdessen den
  // gesuchten Begriff im Treffer-Text (siehe useHighlightParam) und
  // springen – bei Bedarf – zur richtigen Seite.
  if (result.type === "content") {
    return `/dashboard/content/${result.id}/edit`;
  }
  // Benutzer haben wie Inhalte eine eigene Detailseite (Bearbeiten-Ansicht)
  // – dahin springt man direkt, statt zur Liste mit markierter Zeile
  // (Nutzervorgabe: "muss die Detailseite aufgerufen werden").
  if (result.type === "user") {
    return `/dashboard/users/${result.id}/edit`;
  }
  // Formulare haben wie Inhalte/Benutzer eine eigene Detailseite (Editor)
  // – dahin springt man direkt, statt zur Liste mit markierter Zeile.
  if (result.type === "form") {
    return `/dashboard/forms/${result.id}`;
  }
  // Galerien haben (anders als FAQ) eine eigene Detailseite (Editor)
  // – dahin springt man direkt, statt zur Liste mit markierter Zeile.
  if (result.type === "gallery") {
    return `/dashboard/content/galleries/${result.id}`;
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
