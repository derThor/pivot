import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  FileCheck2,
  FolderTree,
  Image as ImageIcon,
  PenLine,
  Plus,
  TrendingUp,
  Upload,
  Users as UsersIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StorageQuotaBanner } from "@/components/storage-quota-banner";
import { SystemMessage } from "@/components/ui/system-message";
import {
  getContentList,
  getCurrentUser,
  getMediaList,
  getMediaStorageUsage,
  getPublicSettings,
  getUsers,
  type ContentStatus,
} from "@/lib/api-server";
import { cn } from "@/lib/utils";

const statusLabel: Record<ContentStatus, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

const statusBadgeClassName: Record<ContentStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  DRAFT: "bg-slate-200 text-slate-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

// Donut-/Legenden-Farben der Statusverteilung – bewusst eigene, feste
// Zuordnung statt statusBadgeClassName (dort geht es um Badges in Listen,
// hier um Datenpunkte in einem Chart mit fester kategorialer Reihenfolge).
const statusChartColor: Record<ContentStatus, string> = {
  PUBLISHED: "#10b981",
  DRAFT: "#94a3b8",
  SCHEDULED: "#3b82f6",
  ARCHIVED: "#d1d5db",
};

const statusDotClassName: Record<ContentStatus, string> = {
  PUBLISHED: "bg-emerald-500",
  DRAFT: "bg-slate-400",
  SCHEDULED: "bg-blue-500",
  ARCHIVED: "bg-gray-300",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const numberFormatter = new Intl.NumberFormat("de-DE");

const quickActions = [
  { label: "Neuer Inhalt", href: "/dashboard/content/new", icon: Plus },
  { label: "Medien", href: "/dashboard/media", icon: Upload },
  { label: "Benutzer", href: "/dashboard/users", icon: UsersIcon },
  { label: "Kategorien", href: "/dashboard/categories", icon: FolderTree },
];

// Nur zur Optik: es gibt aktuell kein View-Tracking im Backend, daher ein
// stabiler (id-basierter), aber frei erfundener Platzhalter-Aufrufwert statt
// echter Zahlen. Sobald echtes Tracking existiert, hier durch die reale
// Kennzahl ersetzen.
function placeholderViews(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 100 + (hash % 4900);
}

// Catmull-Rom-artige Glättung durch eine Punktfolge, für einen weichen statt
// eckigen Linienverlauf im (rein dekorativen) Aufrufe-Chart.
function smoothLinePath(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(i - 1, 0)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(i + 2, points.length - 1)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  }
  return d;
}

const heroChartMonths = ["Mär", "Apr", "Mai", "Jun", "Jul", "Aug"];
// Platzhalter-Werte (0-100), keine echte Kennzahl – siehe placeholderViews.
const heroChartValues = [46, 58, 52, 60, 74, 92];

function HeroChart() {
  const width = 600;
  const height = 150;
  const top = 12;
  const bottom = 118;
  const step = width / (heroChartValues.length - 1);
  const points: [number, number][] = heroChartValues.map((value, i) => [
    i * step,
    bottom - (value / 100) * (bottom - top),
  ]);
  const linePath = smoothLinePath(points);
  const areaPath = `${linePath} L ${width},${bottom} L 0,${bottom} Z`;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[130px] w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="heroChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8EE44" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#C8EE44" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#heroChartGradient)" />
        <path
          d={linePath}
          fill="none"
          stroke="#C8EE44"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-dark-surface-foreground/50">
        {heroChartMonths.map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
    </div>
  );
}

function StatusDonut({
  segments,
}: {
  segments: { status: ContentStatus; count: number }[];
}) {
  const total = segments.reduce((sum, seg) => sum + seg.count, 0);
  const size = 168;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 ? 6 : 0;

  let cumulative = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="size-[168px] shrink-0"
      aria-hidden="true"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={strokeWidth}
          />
        ) : (
          segments.map((seg) => {
            const dash = (seg.count / total) * circumference;
            const visibleDash = Math.max(dash - gap, 0);
            const offset = -(cumulative + gap / 2);
            cumulative += dash;
            return (
              <circle
                key={seg.status}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={statusChartColor[seg.status]}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${visibleDash} ${circumference - visibleDash}`}
                strokeDashoffset={offset}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}

export default async function DashboardPage() {
  const [
    user,
    published,
    drafts,
    scheduled,
    archived,
    media,
    users,
    recent,
    settings,
    storageUsage,
  ] = await Promise.all([
    getCurrentUser(),
    getContentList({ status: "PUBLISHED", pageSize: 1 }),
    getContentList({ status: "DRAFT", pageSize: 1 }),
    getContentList({ status: "SCHEDULED", pageSize: 1 }),
    getContentList({ status: "ARCHIVED", pageSize: 1 }),
    getMediaList({ pageSize: 1 }),
    getUsers({ pageSize: 1 }),
    // `/content` ist bereits standardmäßig nach `updatedAt desc` sortiert
    // (siehe content.service.ts) – für "Zuletzt bearbeitet" reicht ein
    // simpler pageSize-Cutoff, kein eigener Sortier-Parameter nötig.
    getContentList({ pageSize: 5 }),
    getPublicSettings(),
    getMediaStorageUsage(),
  ]);

  const statusSegments: { status: ContentStatus; count: number }[] = [
    { status: "PUBLISHED", count: published?.meta.total ?? 0 },
    { status: "DRAFT", count: drafts?.meta.total ?? 0 },
    { status: "SCHEDULED", count: scheduled?.meta.total ?? 0 },
    { status: "ARCHIVED", count: archived?.meta.total ?? 0 },
  ];

  // Trend-Badges (+3, +1, …) sind Platzhalter, s.o. – es gibt keine
  // historischen Snapshots, um echte Deltas zu berechnen.
  const stats = [
    {
      label: "Veröffentlichte Inhalte",
      value: published?.meta.total.toString() ?? "–",
      icon: FileCheck2,
      trend: "+3",
      dark: true,
    },
    {
      label: "Entwürfe",
      value: drafts?.meta.total.toString() ?? "–",
      icon: PenLine,
      trend: "+1",
    },
    {
      label: "Medien",
      value: media?.meta.total.toString() ?? "–",
      icon: ImageIcon,
      trend: "+9",
    },
    {
      label: "Benutzer",
      value: users?.meta.total.toString() ?? "–",
      icon: UsersIcon,
      trend: "0",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Dashboard" />

      {settings?.maintenanceModeEnabled && (
        <SystemMessage
          variant="neutral"
          title="Wartungsmodus aktiv"
          description="Die Website ist aktuell im Wartungsmodus und für Besucher nicht erreichbar."
        />
      )}

      <StorageQuotaBanner usage={storageUsage} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-none bg-dark-surface text-dark-surface-foreground">
          <CardContent className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
              Willkommen zurück, {user?.firstName ?? user?.lastName ?? ""} 👋
            </span>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-dark-surface-foreground/60">
                Gesamtaufrufe der letzten 7 Monate
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl font-semibold tracking-tight">
                  35.600
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                  <TrendingUp className="size-3" />
                  +27,5%
                </span>
              </div>
            </div>
            <HeroChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statusverteilung</CardTitle>
            <CardDescription>Alle Inhalte nach Status</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <StatusDonut segments={statusSegments} />
            <ul className="flex min-w-0 flex-1 flex-col gap-3">
              {statusSegments.map((seg) => (
                <li
                  key={seg.status}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        statusDotClassName[seg.status],
                      )}
                    />
                    <span className="truncate text-muted-foreground">
                      {statusLabel[seg.status]}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{seg.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) =>
          stat.dark ? (
            <Card
              key={stat.label}
              className="border-none bg-dark-surface text-dark-surface-foreground"
            >
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary">
                    <stat.icon className="size-5 text-primary-foreground" />
                  </span>
                  <span className="flex items-center gap-0.5 text-xs font-medium text-primary">
                    <ArrowUpRight className="size-3.5" />
                    {stat.trend}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-2xl font-semibold">{stat.value}</span>
                  <span className="break-words text-sm text-dark-surface-foreground/60">
                    {stat.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={stat.label} className="border-none bg-muted">
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background">
                    <stat.icon className="size-5 text-muted-foreground" />
                  </span>
                  <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                    <ArrowUpRight className="size-3.5" />
                    {stat.trend}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-2xl font-semibold">{stat.value}</span>
                  <span className="break-words text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Zuletzt bearbeitet</CardTitle>
            <Link
              href="/dashboard/content"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Alle ansehen
              <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y px-0">
            {!recent || recent.items.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Noch keine Inhalte vorhanden.
              </p>
            ) : (
              recent.items.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/dashboard/content/${entry.id}/edit`}
                  className="flex items-center justify-between gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{entry.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.contentType.name} ·{" "}
                      {entry.categories[0]?.name ?? "Allgemein"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <Eye className="size-3.5" />
                      {numberFormatter.format(placeholderViews(entry.id))}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium",
                        statusBadgeClassName[entry.status],
                      )}
                    >
                      {statusLabel[entry.status]}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {dateFormatter.format(new Date(entry.updatedAt))}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <CardTitle>Schnellzugriffe</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 rounded-xl bg-card px-4 py-6 text-center shadow-sm transition-colors hover:bg-accent"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <action.icon className="size-5 text-muted-foreground" />
                </span>
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
