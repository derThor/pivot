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
} from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";

const navActiveClass =
  "-mx-2 h-auto w-[calc(100%+1rem)] gap-2 overflow-hidden rounded-none px-4 py-3 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 data-active:bg-gradient-to-r data-active:from-orange-400 data-active:to-rose-500 data-active:text-white data-active:shadow-sm data-active:hover:text-white";

const navLabelClass =
  "overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0";

const navGroups = [
  {
    label: "Übersicht",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inhalte",
    items: [
      { title: "Inhalte", url: "/dashboard/content", icon: FileText },
      { title: "Medien", url: "/dashboard/media", icon: ImageIcon },
      { title: "Kategorien", url: "/dashboard/categories", icon: FolderTree },
      { title: "Tags", url: "/dashboard/tags", icon: Tags },
    ],
  },
  {
    label: "Verwaltung",
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
    ],
  },
] as const;

function fallbackInitials(companyName?: string | null) {
  const trimmed = companyName?.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : "TW";
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
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const permissions = user.permissions ?? [];
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !("permission" in item) || permissions.includes(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const canManageSettings = permissions.includes("settings:manage");

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
      <SidebarHeader>
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
        {visibleNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className={navActiveClass}
                    >
                      <item.icon />
                      <span className={navLabelClass}>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {canManageSettings && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboard/settings" />}
                isActive={pathname === "/dashboard/settings"}
                tooltip="Einstellungen"
                className={navActiveClass}
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
              className={navActiveClass}
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
