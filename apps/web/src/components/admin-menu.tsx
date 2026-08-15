"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navGroups } from "@/components/app-sidebar";

const ADMIN_GROUP = navGroups.find((group) => group.label === "Verwaltung")!;

/** Ersetzt die frühere Sidebar-Gruppe "Verwaltung" durch ein Dropdown im
 * Header (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage) – liest dieselbe
 * `navGroups`-Datenquelle wie Sidebar/Breadcrumbs/Befehlspalette, damit es
 * keine zweite, unabhängig zu pflegende Liste gibt. */
export function AdminMenu({ permissions }: { permissions: string[] }) {
  const items = ADMIN_GROUP.items.filter(
    (item) => !("permission" in item) || permissions.includes(item.permission),
  );
  if (items.length === 0) return null;

  const Icon = ADMIN_GROUP.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="group flex h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted/40 data-popup-open:border-transparent data-popup-open:bg-primary data-popup-open:text-primary-foreground"
          />
        }
      >
        <Icon className="size-4" />
        <span className="hidden sm:inline">{ADMIN_GROUP.label}</span>
        <ChevronDown className="size-4 transition-transform duration-150 group-data-popup-open:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[380px] p-4 sm:w-[460px]">
        <p className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {ADMIN_GROUP.label}
        </p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.url}
              render={<Link href={item.url} />}
              className="h-auto items-start gap-3 rounded-xl px-2 py-2"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <item.icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
