"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Inbox, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";
import { FormRowActions } from "@/components/form-row-actions";
import { PaginationControls } from "@/components/pagination-controls";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FormListItem, FormStats, FormStatus } from "@/lib/api-server";

const STATUS_FILTERS: { value: FormStatus | null; label: string }[] = [
  { value: null, label: "Alle" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Entwurf" },
  { value: "paused", label: "Pausiert" },
];

const STATUS_BADGE: Record<FormStatus, { label: string; className: string }> = {
  published: { label: "Live", className: "bg-green-100 text-green-700" },
  draft: { label: "Entwurf", className: "bg-slate-200 text-slate-700" },
  paused: { label: "Pausiert", className: "bg-amber-100 text-amber-700" },
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function FormsView({
  items,
  meta,
  stats,
  activeStatus,
  activeQuery,
}: {
  items: FormListItem[];
  meta: { page: number; pageCount: number };
  stats: FormStats;
  activeStatus: FormStatus | null;
  activeQuery: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(activeQuery);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/dashboard/forms?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    updateParams({ q: value || null });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formulare</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            render={<Link href="/dashboard/forms/submissions" />}
          >
            <Inbox className="size-4" />
            Einsendungen
          </Button>
          <Button type="button" render={<Link href="/dashboard/forms/new" />}>
            <Plus />
            Formular erstellen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Formulare"
          value={String(stats.total)}
          sublabel={`${stats.published} live · ${stats.draft} Entwurf${stats.paused ? ` · ${stats.paused} pausiert` : ""}`}
        />
        <StatCard
          label="Einsendungen"
          value={String(stats.submissionsLast30Days)}
          sublabel="letzte 30 Tage"
        />
        <StatCard
          label="Unbearbeitet"
          value={String(stats.unread)}
          sublabel="noch nicht gelesen"
          valueClassName={stats.unread > 0 ? "text-amber-600" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#F4F4F5] p-1">
          {STATUS_FILTERS.map((filter) => {
            const active = activeStatus === filter.value;
            return (
              <button
                key={filter.value ?? "all"}
                type="button"
                onClick={() => updateParams({ status: filter.value })}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-xl border border-[#D4D4D4] bg-card px-4 sm:flex-none">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Formulare durchsuchen"
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-background">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Felder</TableHead>
              <TableHead>Einsendungen</TableHead>
              <TableHead>Zuletzt geändert</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Keine Formulare gefunden.
                </TableCell>
              </TableRow>
            ) : (
              items.map((form) => {
                const badge = STATUS_BADGE[form.status];
                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/forms/${form.id}`}
                        className="font-medium hover:underline"
                      >
                        {form.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/{form.slug}</p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </TableCell>
                    <TableCell>{form.fields.length}</TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/forms/${form.id}/submissions`}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        {form._count.submissions}
                        {form.unreadSubmissions > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {form.unreadSubmissions} neu
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateFormatter.format(new Date(form.updatedAt))}
                    </TableCell>
                    <TableCell>
                      <FormRowActions id={form.id} name={form.name} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={meta.page}
        pageCount={meta.pageCount}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `/dashboard/forms?${params.toString()}`;
        }}
      />
    </div>
  );
}
