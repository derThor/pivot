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
  Wrench,
  LogOut,
  HelpCircle,
  Images,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

// Unterpunkte (z.B. "FAQs"/"Galerien" unter "Seiten") – deutlich tiefer
// eingerückt als `navActiveClass` (pl-10), sonst wirken sie bei diesem
// stark angepassten, randlosen Zeilen-Design nicht wie eine verschachtelte
// Ebene, sondern wie normale gleichrangige Einträge.
const navSubActiveClass =
  "h-auto w-full gap-2 overflow-hidden rounded-none pl-16 pr-4 py-2 text-sm transition-[gap,padding] duration-200 ease-linear data-active:bg-gradient-to-r data-active:from-orange-400 data-active:to-rose-500 data-active:text-white data-active:shadow-sm data-active:hover:text-white";

// Exportiert, damit `dashboard-breadcrumbs.tsx` dieselbe Gruppen-/Item-
// Struktur wiederverwenden kann – eine einzige Quelle für "welche Seite
// gehört zu welchem Menüpunkt/welcher Gruppe" statt sie zweimal zu
// pflegen (Sidebar-Aktiv-Status und Breadcrumbs würden sonst leicht
// auseinanderlaufen).
export const navGroups = [
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
        title: "Seiten",
        url: "/dashboard/content",
        icon: FileText,
        children: [
          { title: "FAQs", url: "/dashboard/content/faqs", icon: HelpCircle },
          {
            title: "Galerien",
            url: "/dashboard/content/galleries",
            icon: Images,
          },
        ],
      },
      {
        title: "Medien",
        url: "/dashboard/media",
        icon: ImageIcon,
        children: [{ title: "Tags", url: "/dashboard/tags", icon: Tags }],
      },
      { title: "Kategorien", url: "/dashboard/categories", icon: FolderTree },
      {
        title: "Menüs",
        url: "/dashboard/navigation",
        icon: Compass,
        permission: "settings:manage",
      },
      {
        title: "Vorschau-Links",
        url: "/dashboard/content/preview-links",
        icon: Link2,
      },
    ],
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
  group.items.flatMap((item) => [
    item.url,
    ...("children" in item ? item.children.map((child) => child.url) : []),
  ]),
);

// Routen außerhalb der Sidebar-Struktur, die inhaltlich zu einem
// Sidebar-Item gehören und dessen Aktiv-Hervorhebung/Gruppen-Aufklappen
// übernehmen sollen – z.B. ist das eigene Konto (übers Nutzer-Menü statt
// die Sidebar erreichbar) inhaltlich Teil von "Benutzer". Auch von
// `dashboard-breadcrumbs.tsx` genutzt, damit beide nicht auseinanderlaufen.
export const ROUTE_ALIASES: Record<string, string> = {
  "/dashboard/account": "/dashboard/users",
};

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
    for (const item of group.items) {
      if (item.url === url) return group.label;
      if ("children" in item && item.children.some((c) => c.url === url)) {
        return group.label;
      }
    }
  }
  return null;
}

/** Ist `activeItemUrl` das Item selbst ODER eines seiner Unterpunkte
 * (siehe `SidebarMenuSub` unten) – steuert sowohl die Hervorhebung des
 * Eltern-Items als auch die fette Gruppen-Beschriftung. */
function itemMatchesActive(
  item: { url: string; children?: readonly { url: string }[] },
  activeItemUrl: string | null,
): boolean {
  return (
    item.url === activeItemUrl ||
    (item.children?.some((c) => c.url === activeItemUrl) ?? false)
  );
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
  const activeItemUrl = findBestMatchingUrl(
    ROUTE_ALIASES[pathname] ?? pathname,
    ALL_ITEM_URLS,
  );
  const activeGroupLabel = groupLabelForItemUrl(activeItemUrl);

  // Akkordeon-Verhalten: immer höchstens eine Gruppe gleichzeitig
  // aufgeklappt – öffnet man eine, schließt sich die vorherige.
  const [openGroup, setOpenGroup] = React.useState<string | null>(
    () => activeGroupLabel,
  );
  // Unterpunkte (z.B. "FAQs"/"Galerien" unter "Seiten") klappen unabhängig
  // von den Gruppen auf/zu, mehrere gleichzeitig möglich – Set statt
  // einzelnem String, da es (anders als bei Gruppen) kein Bedürfnis nach
  // "nur eine offen" gibt. Initial aufgeklappt, falls direkt auf einen
  // Unterpunkt navigiert wurde (z.B. Seitenaufruf von "/…/faqs").
  const [openSubItems, setOpenSubItems] = React.useState<ReadonlySet<string>>(
    () => {
      const initial = new Set<string>();
      for (const group of navGroups) {
        for (const item of group.items) {
          if (
            "children" in item &&
            item.children.some((c) => c.url === activeItemUrl)
          ) {
            initial.add(item.url);
          }
        }
      }
      return initial;
    },
  );
  // Beim Navigieren in eine andere Gruppe bzw. zu einem Unterpunkt diese
  // aufklappen (löst bei Gruppen die vorherige ab) – als Render-Zeit-
  // Anpassung statt Effekt, da es sich um eine reine Ableitung aus
  // `pathname` handelt.
  const [syncedPathname, setSyncedPathname] = React.useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    if (activeGroupLabel && activeGroupLabel !== openGroup) {
      setOpenGroup(activeGroupLabel);
    }
    for (const group of navGroups) {
      for (const item of group.items) {
        if (
          "children" in item &&
          item.children.some((c) => c.url === activeItemUrl) &&
          !openSubItems.has(item.url)
        ) {
          setOpenSubItems((prev) => new Set(prev).add(item.url));
        }
      }
    }
  }

  function toggleGroup(label: string) {
    setOpenGroup((prev) => (prev === label ? null : label));
  }

  function toggleSubItem(url: string) {
    setOpenSubItems((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
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
          // bleiben dann immer sichtbar. Gruppen, die nach der Rechte-
          // Filterung komplett ohne Items dastehen, haben in diesem Zustand
          // nichts anzuzeigen (kein Icon, kein Platzhaltertext) und werden
          // komplett übersprungen – sonst entstünde eine leere Lücke im
          // eingeklappten Zustand.
          if (sidebarState === "collapsed" && group.items.length === 0) {
            return null;
          }
          const isExpanded = openGroup === group.label;
          const isOpen = sidebarState === "collapsed" || isExpanded;
          const isEmphasized = group.items.some((item) =>
            itemMatchesActive(item, activeItemUrl),
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
                        {group.items.map((item) => {
                          const hasChildren =
                            "children" in item && item.children.length > 0;

                          // Eingeklappter Icon-only-Zustand: kein Platz für
                          // Einrückung/Pfeil/Tooltip-Label der Unterpunkte –
                          // die Kind-Icons werden stattdessen als ganz normale,
                          // gleichrangige Zeilen direkt im Anschluss gerendert
                          // (optisch identisch zu allen anderen Items), statt
                          // sie wie im ausgeklappten Zustand einzurücken.
                          if (sidebarState === "collapsed") {
                            return (
                              <React.Fragment key={item.url}>
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    render={<Link href={item.url} />}
                                    isActive={item.url === activeItemUrl}
                                    tooltip={item.title}
                                    className={navActiveClass}
                                  >
                                    <item.icon />
                                    <span className={navLabelClass}>
                                      {item.title}
                                    </span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                                {hasChildren &&
                                  "children" in item &&
                                  item.children.map((child) => (
                                    <SidebarMenuItem key={child.url}>
                                      <SidebarMenuButton
                                        render={<Link href={child.url} />}
                                        isActive={child.url === activeItemUrl}
                                        tooltip={child.title}
                                        className={navActiveClass}
                                      >
                                        <child.icon />
                                        <span className={navLabelClass}>
                                          {child.title}
                                        </span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                              </React.Fragment>
                            );
                          }

                          // Ist dieses Item selbst (oder eines seiner Kinder)
                          // aktiv, bleiben die Unterpunkte immer aufgeklappt
                          // – unabhängig vom manuellen Auf-/Zuklapp-Status.
                          // Der Toggle-Button wird in diesem Fall ausgeblendet,
                          // da er ohnehin wirkungslos wäre.
                          const isForcedOpen = itemMatchesActive(item, activeItemUrl);
                          const isSubOpen = isForcedOpen || openSubItems.has(item.url);
                          return (
                            <SidebarMenuItem key={item.url}>
                              <div className="relative">
                                <SidebarMenuButton
                                  render={<Link href={item.url} />}
                                  isActive={item.url === activeItemUrl}
                                  tooltip={item.title}
                                  className={cn(navActiveClass, hasChildren && "pr-9")}
                                >
                                  <item.icon />
                                  <span
                                    className={cn(
                                      navLabelClass,
                                      itemMatchesActive(item, activeItemUrl) &&
                                        "font-semibold",
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                </SidebarMenuButton>
                                {hasChildren && !isForcedOpen && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleSubItem(item.url);
                                    }}
                                    aria-label={
                                      isSubOpen
                                        ? `${item.title}-Unterpunkte einklappen`
                                        : `${item.title}-Unterpunkte ausklappen`
                                    }
                                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "size-4 transition-transform duration-200 ease-linear",
                                        isSubOpen && "rotate-90",
                                      )}
                                    />
                                  </button>
                                )}
                              </div>
                              {hasChildren && (
                                <div
                                  className={cn(
                                    "grid transition-[grid-template-rows] duration-200 ease-linear",
                                    isSubOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                                  )}
                                >
                                  <div className="overflow-hidden">
                                    <SidebarMenuSub className="mx-0 border-l-0 px-0 py-0">
                                      {"children" in item &&
                                        item.children.map((child) => (
                                          <SidebarMenuSubItem key={child.url}>
                                            <SidebarMenuSubButton
                                              render={<Link href={child.url} />}
                                              isActive={child.url === activeItemUrl}
                                              className={navSubActiveClass}
                                            >
                                              <child.icon />
                                              <span className={navLabelClass}>
                                                {child.title}
                                              </span>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                  </div>
                                </div>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
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
