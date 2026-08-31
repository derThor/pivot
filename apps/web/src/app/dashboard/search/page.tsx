"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";

import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { cn } from "@/lib/utils";
import { bff } from "@/lib/bff";
import {
  ALL_SEARCH_RESULT_TYPES,
  searchResultHref,
  searchTypeMeta,
  type PagedSearchResult,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search";

const PAGE_SIZE = 10;
// Lokal ist die Suche oft in wenigen Millisekunden fertig – ohne
// Mindestdauer wäre die Ladeanzeige praktisch nie sichtbar. Reine
// Wahrnehmungsbremse, verzögert keine echten Daten.
const MIN_LOADING_MS = 400;
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deckt nur Status-Werte ab, die in `SearchResult.status` tatsächlich
// vorkommen (Content: Großbuchstaben-Enum, Formulare: kleingeschriebene
// Strings) – unbekannte/fehlende Werte werden in der Meta-Zeile schlicht
// weggelassen statt eines Platzhalters.
const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
  published: "Veröffentlicht",
  draft: "Entwurf",
  paused: "Pausiert",
};

interface GroupState {
  data: PagedSearchResult | null;
  page: number;
  isLoading: boolean;
  hrefs: Record<string, string>;
}

type FilterValue = SearchResultType | "all";

/** Detailsuche-Ergebnisseite – Ziel von Enter in der Kopfzeilen-Suche
 * (siehe global-search.tsx): eine einzelne, nach Bereich filterbare
 * Trefferliste (Pillen-Zeile "Alle"/"Seite"/"FAQ"/… mit Trefferzahl, 1:1
 * nach Bildvorlage) statt der früheren, immer parallel sichtbaren
 * Karten-pro-Bereich-Ansicht. Lädt weiterhin jeden Bereich einzeln über
 * `/search/paged` (Gesamtzahl je Bereich für die Pillen-Zahlen nötig),
 * zeigt bei "Alle" aber nur die erste Seite jedes Bereichs zusammengeführt
 * an – echte Seiten-Pagination gibt es nur innerhalb eines einzelnen,
 * ausgewählten Bereichs. Client-Komponente statt Server-Fetch, da
 * `searchResultHref` (aus lib/search.ts, auch von der Kopfzeilen-Suche
 * genutzt) für Treffer ohne eigene Detailseite selbst einen relativen
 * Fetch gegen `/api/search/locate` macht – funktioniert nur im Browser. */
export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const [filter, setFilter] = useState<FilterValue>("all");
  const [groups, setGroups] = useState<
    Partial<Record<SearchResultType, GroupState>>
  >({});

  // Filter auf "Alle" zurücksetzen, sobald sich der Suchbegriff ändert –
  // React-empfohlenes Muster (State beim Rendern anpassen statt in einem
  // Effekt), da ein direktes `setFilter()` im Lade-Effekt unten sonst als
  // unnötige Kaskaden-Render-Quelle gemeldet wird.
  const [isSearching, setIsSearching] = useState(() => Boolean(q));
  const [allPage, setAllPage] = useState(1);
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setFilter("all");
    setGroups({});
    setIsSearching(Boolean(q));
    setAllPage(1);
  }

  async function fetchGroup(
    type: SearchResultType,
    page: number,
  ): Promise<GroupState> {
    const res = await fetch(
      bff(
        `/api/search/paged?type=${type}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    );
    const data: PagedSearchResult | null = await res.json().catch(() => null);
    const items = data?.items ?? [];
    const hrefEntries = await Promise.all(
      items.map(
        async (item) => [item.id, await searchResultHref(item, q, 10)] as const,
      ),
    );
    return {
      data,
      page,
      isLoading: false,
      hrefs: Object.fromEntries(hrefEntries),
    };
  }

  /** Für die Pillen-Pagination (Prev/Next eines einzelnen Bereichs) –
   * per Klick-Handler ausgelöst, nicht aus einem Effekt, deshalb ohne
   * Abbruch-Wächter: setzt sofort den "lädt"-Zustand, dann das Ergebnis. */
  function loadGroup(type: SearchResultType, page: number) {
    setGroups((prev) => ({
      ...prev,
      [type]: {
        data: prev[type]?.data ?? null,
        page,
        isLoading: true,
        hrefs: prev[type]?.hrefs ?? {},
      },
    }));
    void fetchGroup(type, page).then((state) => {
      setGroups((prev) => ({ ...prev, [type]: state }));
    });
  }

  // Erst-Ladung aller Bereiche bei neuem Suchbegriff – mit Abbruch-Wächter
  // (React-Standardmuster für Datenabruf in Effekten), da sonst ein
  // veralteter, bereits verworfener Suchlauf noch `setGroups`/
  // `setIsSearching` aufrufen könnte.
  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    Promise.all([
      Promise.all(
        ALL_SEARCH_RESULT_TYPES.map(async (type) => {
          const state = await fetchGroup(type, 1);
          if (!cancelled) {
            setGroups((prev) => ({ ...prev, [type]: state }));
          }
        }),
      ),
      delay(MIN_LOADING_MS),
    ]).then(() => {
      if (!cancelled) setIsSearching(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeEntries = ALL_SEARCH_RESULT_TYPES.map(
    (type) => [type, groups[type]] as const,
  ).filter(
    ([, group]) => group && (group.isLoading || (group.data?.total ?? 0) > 0),
  );
  // Bewusst nur an `isSearching` gekoppelt (nicht zusätzlich an
  // `activeEntries.length === 0`) – sonst würde die Ansicht schon
  // umschalten, sobald der erste von mehreren Bereichen fertig ist, und
  // die restlichen Kategorie-Pillen würden erst nachträglich einblenden.
  const isInitialLoading = isSearching;
  const hasAnyResult = activeEntries.some(
    ([, group]) => (group?.data?.total ?? 0) > 0,
  );
  const totalAll = activeEntries.reduce(
    (sum, [, group]) => sum + (group?.data?.total ?? 0),
    0,
  );

  const selectedGroup = filter === "all" ? null : groups[filter];
  const rows: { type: SearchResultType; item: SearchResult }[] =
    filter === "all"
      ? activeEntries.flatMap(([type, group]) =>
          (group?.data?.items ?? []).map((item) => ({ type, item })),
        )
      : (selectedGroup?.data?.items ?? []).map((item) => ({
          type: filter,
          item,
        }));
  const pageCount =
    filter === "all"
      ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
      : Math.max(1, Math.ceil((selectedGroup?.data?.total ?? 0) / PAGE_SIZE));
  const currentPage = filter === "all" ? allPage : (selectedGroup?.page ?? 1);
  const pagedRows =
    filter === "all"
      ? rows.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE)
      : rows;

  function goToPage(page: number) {
    if (filter === "all") {
      setAllPage(page);
    } else {
      loadGroup(filter, page);
    }
  }

  function filterPill(value: FilterValue, label: string, count: number) {
    const active = filter === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => {
          setFilter(value);
          setAllPage(1);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
          active
            ? "border-transparent bg-dark-surface text-dark-surface-foreground"
            : "border-button-border bg-transparent hover:bg-muted/40",
        )}
      >
        {label}
        <span
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
            active
              ? "bg-white/20 text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Suchergebnisse" />
      <PageContent plain>
        {!q ? (
          <p className="text-sm text-muted-foreground">
            Gib oben einen Suchbegriff ein. Hier siehst du beispielhaft alle
            indexierten Inhalte.
          </p>
        ) : isInitialLoading ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 px-4 py-16 text-center">
            <Loader2 className="size-8 animate-spin text-foreground" />
            <p className="text-lg font-medium text-foreground">Suche läuft …</p>
          </div>
        ) : !hasAnyResult ? (
          <p className="text-sm text-muted-foreground">
            Keine Treffer für „{q}“.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {filterPill("all", "Alle", totalAll)}
              {activeEntries.map(([type, group]) =>
                filterPill(
                  type,
                  searchTypeMeta[type].label,
                  group?.data?.total ?? 0,
                ),
              )}
            </div>
            <div className="flex flex-col gap-3">
              {pagedRows.map(({ type, item }) => {
                const meta = searchTypeMeta[type];
                const Icon = meta.icon;
                const href =
                  (filter === "all"
                    ? groups[type]?.hrefs[item.id]
                    : selectedGroup?.hrefs[item.id]) ?? meta.href;
                const statusLabel = item.status
                  ? (STATUS_LABELS[item.status] ?? item.status)
                  : null;
                return (
                  <Link
                    key={`${type}-${item.id}`}
                    href={href}
                    className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        meta.badgeClassName,
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            meta.badgeClassName,
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {item.subtitle}
                        </p>
                      )}
                      {statusLabel && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {statusLabel}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
            <PaginationControls
              page={currentPage}
              pageCount={pageCount}
              onPageChange={goToPage}
            />
          </div>
        )}
      </PageContent>
    </div>
  );
}
