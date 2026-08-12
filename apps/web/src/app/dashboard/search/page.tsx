"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_SEARCH_RESULT_TYPES,
  searchResultHref,
  searchTypeMeta,
  type PagedSearchResult,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search";

const PAGE_SIZE_OPTIONS = [6, 9, 12, 15] as const;
const DEFAULT_PAGE_SIZE = 9;

interface GroupState {
  data: PagedSearchResult | null;
  page: number;
  isLoading: boolean;
  hrefs: Record<string, string>;
}

/** Detailsuche-Ergebnisseite – Ziel von Enter in der Kopfzeilen-Suche
 * (siehe global-search.tsx): zeigt alle Treffer gruppiert nach Bereich
 * (Inhalte, FAQ, Galerien, Medien, …), jeder Bereich einzeln paginiert
 * (siehe `/search/paged` – Gesamtzahl + Seite statt eines festen Limits),
 * falls dort entsprechend viele Treffer anfallen. Client-Komponente statt
 * Server-Fetch, da `searchResultHref` (aus lib/search.ts, auch von der
 * Kopfzeilen-Suche genutzt) für Treffer ohne eigene Detailseite selbst
 * einen relativen Fetch gegen `/api/search/locate` macht – funktioniert
 * nur im Browser. */
export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [groups, setGroups] = useState<Partial<Record<SearchResultType, GroupState>>>({});

  async function loadGroup(type: SearchResultType, page: number, size: number) {
    setGroups((prev) => ({
      ...prev,
      [type]: { data: prev[type]?.data ?? null, page, isLoading: true, hrefs: prev[type]?.hrefs ?? {} },
    }));
    const res = await fetch(
      `/api/search/paged?type=${type}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${size}`,
    );
    const data: PagedSearchResult | null = await res.json().catch(() => null);
    const items = data?.items ?? [];
    const hrefEntries = await Promise.all(
      items.map(async (item) => [item.id, await searchResultHref(item, q, 10)] as const),
    );
    setGroups((prev) => ({
      ...prev,
      [type]: { data, page, isLoading: false, hrefs: Object.fromEntries(hrefEntries) },
    }));
  }

  useEffect(() => {
    if (!q) {
      setGroups({});
      return;
    }
    setGroups({});
    for (const type of ALL_SEARCH_RESULT_TYPES) {
      loadGroup(type, 1, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pageSize]);

  const activeEntries = ALL_SEARCH_RESULT_TYPES.map((type) => [type, groups[type]] as const).filter(
    ([, group]) => group && (group.isLoading || (group.data?.total ?? 0) > 0),
  );
  const isInitialLoading = activeEntries.length === 0 && Object.keys(groups).length > 0;
  const hasAnyResult = activeEntries.some(([, group]) => (group?.data?.total ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={q ? `Suchergebnisse für „${q}“` : "Suche"} />
        {q && hasAnyResult && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Einträge pro Seite
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
              items={Object.fromEntries(
                PAGE_SIZE_OPTIONS.map((size) => [String(size), String(size)]),
              )}
            >
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {!q ? (
        <p className="text-sm text-muted-foreground">
          Bitte einen Suchbegriff eingeben.
        </p>
      ) : isInitialLoading ? (
        <p className="text-sm text-muted-foreground">Suche…</p>
      ) : !hasAnyResult ? (
        <p className="text-sm text-muted-foreground">
          Keine Treffer für „{q}“.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeEntries.map(([type, group]) => {
            if (!group) return null;
            const meta = searchTypeMeta[type];
            const Icon = meta.icon;
            const total = group.data?.total ?? 0;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));
            return (
              <div
                key={type}
                className="overflow-hidden rounded-2xl bg-card shadow-card"
              >
                <div className="flex items-center gap-2 border-b px-6 py-4">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badgeClassName}`}
                  >
                    <Icon className="size-3.5" />
                    <h2>{meta.label}</h2>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({total})
                  </span>
                </div>
                <ul className="divide-y">
                  {(group.data?.items ?? []).map((item: SearchResult) => (
                    <li key={item.id}>
                      <Link
                        href={group.hrefs[item.id] ?? meta.href}
                        className="flex items-center justify-between gap-3 px-6 py-4 text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {pageCount > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Vorherige Seite"
                      disabled={group.page <= 1 || group.isLoading}
                      onClick={() => loadGroup(type, group.page - 1, pageSize)}
                    >
                      <ChevronLeft />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Seite {group.page} von {pageCount}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Nächste Seite"
                      disabled={group.page >= pageCount || group.isLoading}
                      onClick={() => loadGroup(type, group.page + 1, pageSize)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
