"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTE_ALIASES, findBestMatchingUrl, navGroups } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";

const ADMIN_GROUP = navGroups.find((group) => group.label === "Verwaltung")!;

/** Ersetzt die frühere Sidebar-Gruppe "Verwaltung" durch ein Dropdown im
 * Header (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage) – liest dieselbe
 * `navGroups`-Datenquelle wie Sidebar/Breadcrumbs/Befehlspalette, damit es
 * keine zweite, unabhängig zu pflegende Liste gibt.
 *
 * Aktiv-Zustand (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage): ist eine
 * der Verwaltung-Unterseiten die aktuelle Route, bleibt die Pille dauerhaft
 * grün (nicht nur while geöffnet) und der jeweilige Eintrag im Dropdown
 * bekommt selbst einen grünen Hintergrund + grüne Icon-Box – dieselbe
 * `findBestMatchingUrl`/`ROUTE_ALIASES`-Logik wie in der Sidebar, damit
 * beide nicht auseinanderlaufen. */
export function AdminMenu({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = ADMIN_GROUP.items.filter(
    (item) => !("permission" in item) || permissions.includes(item.permission),
  );
  if (items.length === 0) return null;

  const Icon = ADMIN_GROUP.icon;
  const activeItemUrl = findBestMatchingUrl(
    ROUTE_ALIASES[pathname] ?? pathname,
    items.map((item) => item.url),
  );
  const isGroupActive = activeItemUrl !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        openOnHover
        closeDelay={150}
        render={
          <button
            type="button"
            className={cn(
              "group flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors data-popup-open:border-transparent data-popup-open:bg-primary data-popup-open:text-primary-foreground",
              isGroupActive
                ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-card hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          />
        }
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="hidden sm:inline">{ADMIN_GROUP.label}</span>
        <ChevronDown className="size-4 transition-transform duration-150 group-data-popup-open:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[380px] p-4 sm:w-[460px]">
        <p className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {ADMIN_GROUP.label}
        </p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {items.map((item) => {
            const isActive = item.url === activeItemUrl;
            return (
              <DropdownMenuItem
                key={item.url}
                render={<Link href={item.url} />}
                className={cn(
                  "h-auto items-start gap-3 rounded-xl px-2 py-2 transition-colors focus:bg-primary/15",
                  isActive && "bg-primary/15",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground group-focus/dropdown-menu-item:bg-primary group-focus/dropdown-menu-item:text-primary-foreground",
                  )}
                >
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
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
