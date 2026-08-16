"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, UserCog } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AdminMenu } from "@/components/admin-menu";
import { CommandPalette } from "@/components/command-palette";
import { HeaderSearch } from "@/components/header-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/api-server";
import { formatName } from "@/lib/utils";
import { listLocalDrafts, onLocalDraftsChanged } from "@/lib/local-drafts";

function initials(user: CurrentUser) {
  const name = formatName(user);
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function DashboardHeader({
  user,
  defaultPageSize,
  systemMessageCount = 0,
}: {
  user: CurrentUser;
  defaultPageSize: number;
  systemMessageCount?: number;
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Lokale (nur in diesem Browser gespeicherte) Entwürfe fließen zusätzlich
  // zu den echten Server-weiten Systemmeldungen in den Glocken-Badge ein
  // (Nutzervorgabe, 2026-08-16: "es gibt nicht gespeicherte Entwürfe, wird
  // aber nicht bei der Glocke angezeigt") – lässt sich nicht serverseitig
  // in `dashboard/layout.tsx` berechnen, da `localStorage` nie den Browser
  // verlässt. `onLocalDraftsChanged` hält den Zähler live synchron mit dem
  // Content-Editor im selben Tab (siehe lib/local-drafts.ts).
  const [localDraftCount, setLocalDraftCount] = useState(0);
  useEffect(() => {
    function sync() {
      setLocalDraftCount(listLocalDrafts().length);
    }
    sync();
    return onLocalDraftsChanged(sync);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const permissions = user.permissions ?? [];
  // Anders als die restlichen Verwaltung-Einträge ist die Glocke nicht
  // hinter `settings:manage` versteckt: der lokale Entwurfs-Hinweis
  // betrifft jeden Nutzer, der Inhalte bearbeitet, nicht nur Admins.
  //
  // Zählt 1:1 dieselben Karten, die auch auf /dashboard/system-messages
  // sichtbar sind (jeder lokale Entwurf einzeln) – nicht nur "Kategorien"
  // (Nutzer-Feedback: "ich habe 3 Nachrichten, Badge zeigt nur 1").
  const totalMessageCount = systemMessageCount + localDraftCount;

  return (
    <header className="sticky top-0 z-40 flex h-20 min-w-0 shrink-0 items-center gap-3 border-b bg-background/70 px-4 py-4 backdrop-blur-md">
      <SidebarTrigger />
      <div className="ml-6">
        <AdminMenu permissions={permissions} />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <HeaderSearch
          defaultPageSize={defaultPageSize}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <CommandPalette
          user={user}
          defaultPageSize={defaultPageSize}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
        />
        <div className="relative shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-full bg-card"
            render={<Link href="/dashboard/system-messages" />}
            aria-label="Systemnachrichten"
          >
            <Bell />
          </Button>
          {totalMessageCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold text-white">
              {totalMessageCount}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-11 shrink-0 gap-2 rounded-full border bg-card pl-1.5 pr-3 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-popup-open:border-transparent data-popup-open:bg-primary data-popup-open:text-primary-foreground"
              />
            }
          >
            <Avatar>
              <AvatarFallback>{initials(user)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {formatName(user)}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem render={<Link href="/dashboard/account" />}>
              <UserCog />
              Konto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <LogOut />
              {isLoggingOut ? "Wird abgemeldet…" : "Abmelden"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
