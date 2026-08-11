import Link from "next/link";
import {
  FileCheck2,
  FileText,
  FolderTree,
  PenLine,
  Image as ImageIcon,
  Upload,
  Users as UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  getContentList,
  getMediaList,
  getUsers,
  type ContentStatus,
} from "@/lib/api-server";
import { formatName } from "@/lib/utils";

const statusLabel: Record<ContentStatus, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

const statusClassName: Record<ContentStatus, string> = {
  PUBLISHED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  DRAFT:
    "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  SCHEDULED:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  ARCHIVED: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});

const quickActions = [
  { label: "Neuer Inhalt", href: "/dashboard/content/new", icon: FileText },
  { label: "Medien", href: "/dashboard/media", icon: Upload },
  { label: "Benutzer", href: "/dashboard/users", icon: UsersIcon },
  { label: "Kategorien", href: "/dashboard/categories", icon: FolderTree },
];

export default async function DashboardPage() {
  const [published, drafts, media, users, recent] = await Promise.all([
    getContentList({ status: "PUBLISHED", pageSize: 1 }),
    getContentList({ status: "DRAFT", pageSize: 1 }),
    getMediaList({ pageSize: 1 }),
    getUsers({ pageSize: 1 }),
    // `/content` ist bereits standardmäßig nach `updatedAt desc` sortiert
    // (siehe content.service.ts) – für "Zuletzt bearbeitet" reicht ein
    // simpler pageSize-Cutoff, kein eigener Sortier-Parameter nötig.
    getContentList({ pageSize: 5 }),
  ]);

  const stats = [
    {
      label: "Veröffentlichte Inhalte",
      value: published?.meta.total.toString() ?? "–",
      icon: FileCheck2,
      dark: true,
    },
    {
      label: "Entwürfe",
      value: drafts?.meta.total.toString() ?? "–",
      icon: PenLine,
    },
    {
      label: "Medien",
      value: media?.meta.total.toString() ?? "–",
      icon: ImageIcon,
    },
    {
      label: "Benutzer",
      value: users?.meta.total.toString() ?? "–",
      icon: UsersIcon,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) =>
              stat.dark ? (
                <Card
                  key={stat.label}
                  className="border-none bg-dark-surface text-dark-surface-foreground"
                >
                  <CardContent className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary">
                      <stat.icon className="size-5 text-primary-foreground" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-dark-surface-foreground/60">
                        {stat.label}
                      </span>
                      <span className="text-2xl font-semibold text-dark-surface-foreground">
                        {stat.value}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card key={stat.label} className="border-none bg-muted">
                  <CardContent className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background">
                      <stat.icon className="size-5 text-muted-foreground" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-muted-foreground">
                        {stat.label}
                      </span>
                      <span className="text-2xl font-semibold">
                        {stat.value}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Zuletzt bearbeitet</CardTitle>
              <Link
                href="/dashboard/content"
                className="text-sm font-medium text-primary hover:underline"
              >
                Alle ansehen
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
                      <span className="truncate font-medium">
                        {entry.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.contentType.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={statusClassName[entry.status]}
                      >
                        {statusLabel[entry.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {dateFormatter.format(new Date(entry.updatedAt))}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Schnellzugriffe</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.href}
                  variant="outline"
                  render={<Link href={action.href} />}
                  className="h-auto flex-col gap-2 py-4"
                >
                  <action.icon className="size-5" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
