"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, UserCog } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { GlobalSearch } from "@/components/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/api-server";
import { formatName } from "@/lib/utils";

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
}: {
  user: CurrentUser;
  defaultPageSize: number;
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    <header className="sticky top-0 z-40 flex h-20 min-w-0 shrink-0 items-center gap-3 border-b bg-background/70 px-4 py-4 backdrop-blur-md">
      <SidebarTrigger />
      <div className="ml-auto flex min-w-0 items-center gap-1">
        <CommandPalette user={user} defaultPageSize={defaultPageSize} />
        <Button
          variant="ghost"
          size="icon"
          className="size-12 shrink-0 rounded-full"
          disabled
        >
          <Bell />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-12 shrink-0 gap-2 rounded-full bg-muted/60 pl-1.5 pr-3 hover:bg-muted"
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
        {/* Zuletzt im DOM: die einzige Komponente, die sich per Hover/
            Fokus nach LINKS ausfährt (siehe global-search.tsx) – ihr
            fixer 48px-Anker muss die tatsächliche rechte Kante der
            Kopfzeile sein, sonst würde die ausgefahrene Box auf schmalen
            Bildschirmen über den linken Rand hinaus (negative x-Position)
            gerendert und die Seite horizontal aufreißen. Ab `sm` bleibt
            der Anker zwar rechts (fürs Ausfahren), visuell wandert die
            Lupe per `order` aber wieder an den Anfang, wie auf Desktop
            gewünscht (nur mobil soll sie ganz rechts stehen). */}
        <div className="sm:order-first">
          <GlobalSearch defaultPageSize={defaultPageSize} />
        </div>
      </div>
    </header>
  );
}
