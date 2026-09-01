import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  getContentList,
  getPublicSettings,
  type ContentStatus,
} from "@/lib/api-server";
import { ContentFilterBar } from "@/components/content-filter-bar";
import { ContentTable } from "@/components/content-table";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import { StatCard } from "@/components/stat-card";

const STATUS_FILTERS: ContentStatus[] = [
  "PUBLISHED",
  "SCHEDULED",
  "DRAFT",
  "ARCHIVED",
];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const {
    page: pageParam,
    status: statusParam,
    q: queryParam,
  } = await searchParams;
  const page = Number(pageParam) || 1;
  // Unbekannter Wert in der URL fällt still auf "Alle" zurück, statt eine
  // leere Liste oder einen 400er aus der API zu erzeugen.
  const status = STATUS_FILTERS.find((s) => s === statusParam);
  const search = queryParam?.trim() || undefined;

  // Performance-Befund, 2026-08-25: `getPublicSettings()` lief vorher allein
  // vor dem `Promise.all()`, obwohl nur der erste `getContentList()`-Aufruf
  // tatsächlich von `pageSize` abhängt – die drei reinen Zähl-Abfragen
  // (fixes `pageSize: 1`) mussten unnötig auf dieses eine Bein warten.
  // Die Zähler laufen bewusst OHNE `search`: Kacheln und Filter-Zähler
  // zeigen immer den Gesamtbestand, unabhängig von Filter/Suche in der
  // Tabelle darunter – dieselbe Entscheidung wie beim Papierkorb (siehe
  // Kommentar in `TrashService.list()`).
  const [settings, published, drafts, scheduled, archived] = await Promise.all([
    getPublicSettings(),
    getContentList({ status: "PUBLISHED", pageSize: 1 }),
    getContentList({ status: "DRAFT", pageSize: 1 }),
    getContentList({ status: "SCHEDULED", pageSize: 1 }),
    getContentList({ status: "ARCHIVED", pageSize: 1 }),
  ]);
  const content = await getContentList({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
    status,
    search,
  });
  const entries = content?.items ?? [];

  const counts = {
    PUBLISHED: published?.meta.total ?? 0,
    DRAFT: drafts?.meta.total ?? 0,
    SCHEDULED: scheduled?.meta.total ?? 0,
    ARCHIVED: archived?.meta.total ?? 0,
  };
  // `ContentStatus` hat genau diese vier Werte, die Summe ist damit exakt
  // der Gesamtbestand – spart gegenüber einer fünften Zähl-Abfrage einen
  // Roundtrip. `content.meta.total` taugt dafür nicht mehr, sobald ein
  // Status- oder Suchfilter aktiv ist.
  const totalCount =
    counts.PUBLISHED + counts.DRAFT + counts.SCHEDULED + counts.ARCHIVED;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Seiten" />
        <Button render={<Link href="/dashboard/content/new" />}>
          <Plus />
          Neue Seite
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Seiten gesamt"
          value={String(totalCount)}
          sublabel="Alle Status"
        />
        <StatCard
          label="Veröffentlicht"
          value={String(counts.PUBLISHED)}
          sublabel="Live auf der Website"
          valueClassName="text-emerald-600"
        />
        <StatCard
          label="Entwürfe"
          value={String(counts.DRAFT)}
          sublabel="Noch nicht veröffentlicht"
        />
        <StatCard
          label="Geplant"
          value={String(counts.SCHEDULED)}
          sublabel="Automatische Veröffentlichung"
          valueClassName="text-amber-600"
        />
      </div>

      <ContentFilterBar counts={{ ...counts, all: totalCount }} />

      <PageContent plain>
        <ContentTable
          entries={entries}
          emptyMessage={
            status || search
              ? "Keine Seiten passen zu diesem Filter."
              : "Noch keine Inhalte vorhanden."
          }
        />

        {content && (
          <PaginationControls
            page={content.meta.page}
            pageCount={content.meta.pageCount}
            buildHref={(p) => {
              // Status/Suche müssen beim Blättern erhalten bleiben – ein
              // reines `?page=…` hätte den Filter bei jedem Seitenwechsel
              // stillschweigend zurückgesetzt.
              const params = new URLSearchParams();
              if (status) params.set("status", status);
              if (search) params.set("q", search);
              params.set("page", String(p));
              return `?${params.toString()}`;
            }}
          />
        )}
      </PageContent>
    </div>
  );
}
