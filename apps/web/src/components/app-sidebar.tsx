"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Settings,
  FolderTree,
  Tags,
  Globe,
  Webhook,
  Link2,
  Compass,
  Layers,
  ChevronRight,
  Puzzle,
  Wrench,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";

const navActiveClass =
  "h-auto w-full gap-2 overflow-hidden rounded-none pl-10 pr-4 py-3 transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:pl-4 data-active:bg-gradient-to-r data-active:from-orange-400 data-active:to-rose-500 data-active:text-white data-active:shadow-sm data-active:hover:text-white";

// Footer-Einträge (Einstellungen/Abmelden) liegen direkt im gepolsterten
// SidebarFooter, nicht in dem eigenen Voll-Breite-Wrapper der
// Akkordeon-Gruppen – bekommen deshalb ihren eigenen Rand-zu-Rand-Trick
// und dieselbe Einrückung wie die erste Ebene (Gruppen-Header).
const navFooterActiveClass =
  "-mx-2 h-auto w-[calc(100%+1rem)] gap-2 overflow-hidden rounded-none px-4 py-3 transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 data-active:bg-gradient-to-r data-active:from-orange-400 data-active:to-rose-500 data-active:text-white data-active:shadow-sm data-active:hover:text-white";

const navLabelClass =
  "overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0";

const navGroups = [
  {
    label: "Übersicht",
    icon: LayoutDashboard,
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inhalte",
    icon: Layers,
    items: [
      {
        title: "Menüs",
        url: "/dashboard/navigation",
        icon: Compass,
        permission: "settings:manage",
      },
      { title: "Seiten", url: "/dashboard/content", icon: FileText },
      { title: "Medien", url: "/dashboard/media", icon: ImageIcon },
      { title: "Kategorien", url: "/dashboard/categories", icon: FolderTree },
      { title: "Tags", url: "/dashboard/tags", icon: Tags },
      {
        title: "Vorschau-Links",
        url: "/dashboard/content/preview-links",
        icon: Link2,
      },
    ],
  },
  {
    label: "Erweiterungen",
    icon: Puzzle,
    items: [],
  },
  {
    label: "Verwaltung",
    icon: Wrench,
    items: [
      {
        title: "Benutzer",
        url: "/dashboard/users",
        icon: Users,
        permission: "users:manage",
      },
      {
        title: "Rollen & Rechte",
        url: "/dashboard/roles",
        icon: ShieldCheck,
        permission: "roles:manage",
      },
      { title: "Websites", url: "/dashboard/sites", icon: Globe },
      {
        title: "Webhooks",
        url: "/dashboard/webhooks",
        icon: Webhook,
        permission: "settings:manage",
      },
    ],
  },
] as const;

const ALL_ITEM_URLS = navGroups.flatMap((group) =>
  group.items.map((item) => item.url),
);

function fallbackInitials(companyName?: string | null) {
  const trimmed = companyName?.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : "TW";
}

/**
 * Wählt die am genauesten passende Item-URL (längste übereinstimmende
 * URL, nicht nur die erste gefundene) – sonst würde z.B. "/dashboard"
 * (Dashboard-Link) als Präfix jeder anderen Route immer zuerst matchen.
 * `startsWith(url + "/")` sorgt dafür, dass auch Detailseiten (Anlegen,
 * Bearbeiten, [id]/...) ihr Eltern-Listen-Item als aktiv markieren –
 * z.B. macht `/dashboard/content/new` oder
 * `/dashboard/content/abc123/edit` den Menüpunkt "Seiten"
 * (`/dashboard/content`) aktiv.
 */
function findBestMatchingUrl(pathname: string, urls: string[]): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const url of urls) {
    const matches = pathname === url || pathname.startsWith(`${url}/`);
    if (matches && url.length > bestLength) {
      best = url;
      bestLength = url.length;
    }
  }
  return best;
}

function groupLabelForItemUrl(url: string | null): string | null {
  if (!url) return null;
  for (const group of navGroups) {
    if (group.items.some((item) => item.url === url)) return group.label;
  }
  return null;
}

export function AppSidebar({
  user,
  logoExpandedUrl,
  logoCollapsedUrl,
  companyName,
}: {
  user: CurrentUser;
  logoExpandedUrl?: string | null;
  logoCollapsedUrl?: string | null;
  companyName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state: sidebarState } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const permissions = user.permissions ?? [];
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      originalItemCount: group.items.length as number,
      items: group.items.filter(
        (item) =>
          !("permission" in item) || permissions.includes(item.permission),
      ),
    }))
    .filter((group) => group.originalItemCount === 0 || group.items.length > 0);
  const canManageSettings = permissions.includes("settings:manage");

  // Best-match aktive Item-URL für den aktuellen Pfad – wird sowohl für
  // die Hervorhebung des Menüpunkts als auch für die fette
  // Gruppen-Beschriftung verwendet (siehe `findBestMatchingUrl`).
  const activeItemUrl = findBestMatchingUrl(pathname, ALL_ITEM_URLS);
  const activeGroupLabel = groupLabelForItemUrl(activeItemUrl);

  // Akkordeon-Verhalten: immer höchstens eine Gruppe gleichzeitig
  // aufgeklappt – öffnet man eine, schließt sich die vorherige.
  const [openGroup, setOpenGroup] = React.useState<string | null>(
    () => activeGroupLabel,
  );
  // Beim Navigieren in eine andere Gruppe hinein diese aufklappen (löst
  // die vorherige ab) – als Render-Zeit-Anpassung statt Effekt, da es
  // sich um eine reine Ableitung aus `pathname` handelt.
  const [syncedPathname, setSyncedPathname] = React.useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    if (activeGroupLabel && activeGroupLabel !== openGroup) {
      setOpenGroup(activeGroupLabel);
    }
  }

  function toggleGroup(label: string) {
    setOpenGroup((prev) => (prev === label ? null : label));
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 py-2 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <div className="flex h-12 w-0 shrink-0 items-center justify-center overflow-hidden rounded-xl opacity-0 shadow-sm transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:opacity-100">
            {logoCollapsedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl({ url: logoCollapsedUrl })}
                alt="Logo"
                className="size-full object-contain"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-orange-400 to-rose-500 text-sm font-semibold text-white">
                {fallbackInitials(companyName)}
              </div>
            )}
          </div>
          <span className="overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            {logoExpandedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl({ url: logoExpandedUrl })}
                alt="strasev CMS"
                className="h-11 w-auto max-w-full object-contain"
              />
            ) : (
              <span className="text-lg font-semibold">strasev CMS</span>
            )}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleNavGroups.map((group) => {
          // Im eingeklappten (icon-only) Zustand macht ein Auf-/Zuklappen der
          // Gruppen keinen Sinn (Labels sind ohnehin ausgeblendet) – Items
          // bleiben dann immer sichtbar. Gruppen ohne Items (aktuell nur
          // "Erweiterungen") haben in diesem Zustand nichts anzuzeigen (kein
          // Icon, kein Platzhaltertext) und werden komplett übersprungen –
          // sonst entstünde eine leere Lücke im eingeklappten Zustand.
          if (sidebarState === "collapsed" && group.items.length === 0) {
            return null;
          }
          const isExpanded = openGroup === group.label;
          const isOpen = sidebarState === "collapsed" || isExpanded;
          const isEmphasized = group.items.some(
            (item) => item.url === activeItemUrl,
          );
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel
                render={<button type="button" />}
                onClick={() => toggleGroup(group.label)}
                className="-mx-2 w-[calc(100%+1rem)] cursor-pointer justify-between gap-2 rounded-none px-4 text-sm font-normal text-sidebar-foreground"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <group.icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      navLabelClass,
                      isEmphasized && "font-semibold",
                    )}
                  >
                    {group.label}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-200 ease-linear",
                    navLabelClass,
                    isOpen && "rotate-90",
                  )}
                />
              </SidebarGroupLabel>
              <div
                className={cn(
                  "-mx-2 grid w-[calc(100%+1rem)] transition-[grid-template-rows] duration-200 ease-linear",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <SidebarGroupContent>
                    {group.items.length === 0 ? (
                      <p
                        className={cn(
                          "px-4 py-1 text-xs text-sidebar-foreground/50",
                          navLabelClass,
                        )}
                      >
                        Bald verfügbar
                      </p>
                    ) : (
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              render={<Link href={item.url} />}
                              isActive={item.url === activeItemUrl}
                              tooltip={item.title}
                              className={navActiveClass}
                            >
                              <item.icon />
                              <span className={navLabelClass}>{item.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    )}
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          {canManageSettings && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboard/settings" />}
                isActive={pathname === "/dashboard/settings"}
                tooltip="Einstellungen"
                className={navFooterActiveClass}
              >
                <Settings />
                <span className={navLabelClass}>Einstellungen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              disabled={isLoggingOut}
              tooltip="Abmelden"
              className={navFooterActiveClass}
            >
              <LogOut />
              <span className={navLabelClass}>
                {isLoggingOut ? "Wird abgemeldet…" : "Abmelden"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
