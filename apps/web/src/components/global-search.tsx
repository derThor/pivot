"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FolderTree,
  Image as ImageIcon,
  Link2,
  Search,
  ShieldCheck,
  Tag as TagIcon,
  Users,
} from "lucide-react";

import { Input } from "@/components/ui/input";

const MIN_QUERY_LENGTH = 3;

type SearchResultType =
  | "content"
  | "category"
  | "tag"
  | "media"
  | "user"
  | "role"
  | "previewLink";

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
}

const typeMeta: Record<
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

async function resultHref(
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
  return `${typeMeta[result.type].href}?${params.toString()}`;
}

export function GlobalSearch({
  defaultPageSize,
}: {
  defaultPageSize: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setOpen(false);
      return;
    }
    setIsLoading(true);
    setOpen(true);
    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
      );
      const data = await res.json().catch(() => null);
      setResults(Array.isArray(data) ? data : []);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function goTo(result: SearchResult) {
    const searchTerm = query.trim();
    setOpen(false);
    setQuery("");
    router.push(await resultHref(result, searchTerm, defaultPageSize));
  }

  return (
    <div ref={containerRef} className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Suchen…"
        className="rounded-full bg-muted/60 pl-9"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full min-w-80 overflow-hidden rounded-2xl border bg-popover py-2 text-popover-foreground shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Suche…
            </div>
          ) : results && results.length > 0 ? (
            <ul className="divide-y">
              {results.map((result) => {
                const meta = typeMeta[result.type];
                const Icon = meta.icon;
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => goTo(result)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {result.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClassName}`}
                      >
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Keine Treffer.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
