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

import { bff } from "@/lib/bff";

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
    badgeClassName: "badge--blue",
  },
  category: {
    label: "Kategorie",
    icon: FolderTree,
    href: "/dashboard/categories",
    badgeClassName: "badge--green",
  },
  tag: {
    label: "Tag",
    icon: TagIcon,
    href: "/dashboard/tags",
    badgeClassName: "badge--amber",
  },
  media: {
    label: "Medium",
    icon: ImageIcon,
    href: "/dashboard/media",
    badgeClassName: "badge--lime",
  },
  user: {
    label: "Benutzer",
    icon: Users,
    href: "/dashboard/users",
    badgeClassName: "badge--ink",
  },
  role: {
    label: "Rolle",
    icon: ShieldCheck,
    href: "/dashboard/roles",
    badgeClassName: "badge--slate",
  },
  previewLink: {
    label: "Vorschau-Link",
    icon: Link2,
    href: "/dashboard/content/preview-links",
    badgeClassName: "badge--blue",
  },
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    href: "/dashboard/content/faqs",
    badgeClassName: "badge--amber",
  },
  gallery: {
    label: "Galerie",
    icon: Images,
    href: "/dashboard/content/galleries",
    badgeClassName: "badge--lime",
  },
  form: {
    label: "Formular",
    icon: ClipboardList,
    href: "/dashboard/forms",
    badgeClassName: "badge--slate",
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
    bff(
      `/api/search/locate?type=${result.type}&id=${result.id}&pageSize=${defaultPageSize}`,
    ),
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
