"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { mediaUrl } from "@/lib/media";
import { cn, formatName, formatRelativeTime, initials } from "@/lib/utils";

export function DashboardHeader({
  user,
  defaultPageSize,
  systemMessageCount = 0,
  allowTwoFactor = false,
  keyboardShortcutsEnabled = true,
}: {
  user: CurrentUser;
  defaultPageSize: number;
  systemMessageCount?: number;
  allowTwoFactor?: boolean;
  keyboardShortcutsEnabled?: boolean;
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Mobil ersetzt die aufgeklappte Suche den kompletten übrigen
  // Header-Inhalt (Nutzervorgabe: "oben im Header, nicht darunter") –
  // deshalb hier gehalten statt in `HeaderSearch` selbst, das kennt seine
  // Geschwister-Elemente im Header nicht.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
  // Zählt exakt die ungelesenen Einträge im echten Benachrichtigungs-
  // Postfach (Nutzervorgabe, 2026-08-21: Badge zeigte vorher mehr an, als
  // auf der Seite selbst sichtbar war, weil lokale Entwürfe zusätzlich
  // mitgezählt wurden – die aber, weil rein browserlokal, nie als Zeile
  // im serverseitigen Postfach auftauchen konnten. Badge und Seite zeigen
  // jetzt dieselbe Zahl).
  const totalMessageCount = systemMessageCount;
  const canViewSettings = permissions.includes("settings:read");

  return (
    <header className="sticky top-0 z-40 flex h-20 min-w-0 shrink-0 items-center gap-3 border-b bg-background/70 px-4 py-4 backdrop-blur-md">
      {!mobileSearchOpen && (
        <>
          <SidebarTrigger />
          <div className="ml-6">
            <AdminMenu permissions={permissions} />
          </div>
        </>
      )}
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          mobileSearchOpen ? "w-full" : "ml-auto",
        )}
      >
        <HeaderSearch
          defaultPageSize={defaultPageSize}
          onOpenPalette={() => setPaletteOpen(true)}
          mobileOpen={mobileSearchOpen}
          onMobileOpenChange={setMobileSearchOpen}
          shortcutsEnabled={keyboardShortcutsEnabled}
        />
        <CommandPalette
          user={user}
          defaultPageSize={defaultPageSize}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          shortcutsEnabled={keyboardShortcutsEnabled}
        />
        {!mobileSearchOpen && (
          <>
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full bg-card"
                render={<Link href="/dashboard/system-messages" />}
                aria-label="Benachrichtigungen"
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
                    className="group h-11 shrink-0 gap-2 rounded-full border bg-card pl-1.5 pr-3 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-popup-open:border-transparent data-popup-open:bg-primary data-popup-open:text-primary-foreground"
                  />
                }
              >
                <Avatar>
                  {user.avatarUrl && (
                    <AvatarImage src={mediaUrl({ url: user.avatarUrl })} />
                  )}
                  <AvatarFallback>{initials(user)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">
                  {formatName(user)}
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-popup-open:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="w-80 p-0">
                <div className="flex items-center gap-3 p-4">
                  <Avatar size="lg" className="size-11">
                    {user.avatarUrl && (
                      <AvatarImage src={mediaUrl({ url: user.avatarUrl })} />
                    )}
                    <AvatarFallback className="bg-neutral-900 text-white">
                      {initials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{formatName(user)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                  {user.roles.map((role) => (
                    <Badge
                      key={role.id}
                      className="bg-neutral-900 text-white hover:bg-neutral-900"
                    >
                      {role.name}
                    </Badge>
                  ))}
                  {allowTwoFactor && (
                    <Badge
                      variant="secondary"
                      className={
                        user.twoFactorEnabled
                          ? "gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                          : "gap-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                      }
                    >
                      {user.twoFactorEnabled ? (
                        <ShieldCheck className="size-3" />
                      ) : (
                        <ShieldOff className="size-3" />
                      )}
                      {user.twoFactorEnabled ? "2FA aktiv" : "2FA inaktiv"}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator className="mx-0" />
                <div className="flex flex-col p-2">
                  <DropdownMenuItem
                    render={<Link href="/dashboard/account" />}
                    className="h-auto items-start gap-3 py-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <UserCog className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">Mein Konto</span>
                      <span className="text-xs text-muted-foreground">
                        Profil, Sprache, Zeitzone
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/dashboard/account?tab=security" />}
                    className="h-auto items-start gap-3 py-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ShieldCheck className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">Sicherheit &amp; 2FA</span>
                      <span className="text-xs text-muted-foreground">
                        Passwort, Authenticator, Sitzungen
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/dashboard/account?tab=notifications" />}
                    className="h-auto items-start gap-3 py-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Bell className="size-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">Benachrichtigungen</span>
                      <span className="text-xs text-muted-foreground">
                        Einstellungen &amp; Hinweise
                      </span>
                    </span>
                  </DropdownMenuItem>
                </div>
                {canViewSettings && (
                  <>
                    <DropdownMenuSeparator className="mx-0" />
                    <div className="p-2">
                      <DropdownMenuItem
                        render={<Link href="/dashboard/settings" />}
                        className="justify-between"
                      >
                        Einstellungen
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </DropdownMenuItem>
                    </div>
                  </>
                )}
                <DropdownMenuSeparator className="mx-0" />
                <div className="p-2">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="gap-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                      <LogOut className="size-4" />
                    </span>
                    {isLoggingOut ? "Wird abgemeldet…" : "Abmelden"}
                  </DropdownMenuItem>
                </div>
                {user.lastLoginAt && (
                  <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                    Letzte Anmeldung: {formatRelativeTime(user.lastLoginAt)}
                  </p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}
