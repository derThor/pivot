"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut, Plus, Search, Settings, UserCog } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navGroups } from "@/components/app-sidebar";
import { searchResultHref, searchTypeMeta, type SearchResult } from "@/lib/search";
import type { CurrentUser } from "@/lib/api-server";

const MIN_QUERY_LENGTH = 3;

interface PaletteItem {
  id: string;
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  badge?: { label: string; className: string };
  onSelect: () => void | Promise<void>;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

function matches(label: string, query: string) {
  return label.toLowerCase().includes(query.toLowerCase());
}

export function CommandPalette({
  user,
  defaultPageSize,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  user: CurrentUser;
  defaultPageSize: number;
  /** Weggelassen = eigener interner Zustand (nur per Strg/Cmd+K
   * erreichbar). `header-search.tsx` steuert die Palette dagegen von
   * außen, damit der "Strg K"-Badge im Suchfeld sie öffnen kann. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const permissions = user.permissions ?? [];
  const canViewSettings = permissions.includes("settings:read");

  // Globaler Strg/Cmd+K-Shortcut öffnet die Palette von überall im
  // Dashboard aus – unabhängig davon, wo der Fokus gerade liegt (siehe
  // sidebar.tsx für dasselbe Muster bei Strg+B).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Eingabe/Auswahl beim Öffnen zurücksetzen – als Render-Zeit-Anpassung
  // statt setState im Effekt (gleiches Muster wie `syncedPathname` in
  // app-sidebar.tsx), damit kein zusätzlicher Render-Durchlauf nötig ist.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setSearchResults(null);
    }
  }

  // Fokus ist ein echter DOM-Seiteneffekt (kein State) und gehört damit
  // in einen Effekt – die Öffnen-Animation muss zuerst abschließen, sonst
  // greift der Fokus noch nicht zuverlässig.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      // Kein Reset von `searchResults` nötig: die "Suchergebnisse"-Gruppe
      // wird unten ohnehin nur ab MIN_QUERY_LENGTH gerendert, ein
      // veralteter Wert bleibt also unsichtbar.
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=8`,
      );
      const data = await res.json().catch(() => null);
      setSearchResults(Array.isArray(data) ? data : []);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function close() {
    setOpen(false);
  }

  function goTo(url: string) {
    return () => {
      close();
      router.push(url);
    };
  }

  async function handleLogout() {
    close();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navItems: PaletteItem[] = navGroups.flatMap((group) =>
    group.items
      .filter((item) => !("permission" in item) || permissions.includes(item.permission))
      .map((item) => ({
        id: `nav-${item.url}`,
        icon: item.icon,
        label: item.title,
        subtitle: group.label,
        onSelect: goTo(item.url),
      })),
  );

  const actionItems: PaletteItem[] = [
    {
      id: "action-new-content",
      icon: Plus,
      label: "Neuen Inhalt erstellen",
      onSelect: goTo("/dashboard/content/new"),
    },
    {
      id: "action-account",
      icon: UserCog,
      label: "Konto",
      onSelect: goTo("/dashboard/account"),
    },
    ...(canViewSettings
      ? [
          {
            id: "action-settings",
            icon: Settings,
            label: "Einstellungen",
            onSelect: goTo("/dashboard/settings"),
          },
        ]
      : []),
    {
      id: "action-logout",
      icon: LogOut,
      label: "Abmelden",
      onSelect: handleLogout,
    },
  ];

  const trimmedQuery = query.trim();
  const searchItems: PaletteItem[] = (searchResults ?? []).map((result) => {
    const meta = searchTypeMeta[result.type];
    return {
      id: `search-${result.type}-${result.id}`,
      icon: meta.icon,
      label: result.title,
      badge: { label: meta.label, className: meta.badgeClassName },
      onSelect: async () => {
        close();
        router.push(await searchResultHref(result, trimmedQuery, defaultPageSize));
      },
    };
  });

  const groups: PaletteGroup[] = useMemo(() => {
    const filteredNav = trimmedQuery
      ? navItems.filter((item) => matches(item.label, trimmedQuery))
      : navItems;
    const filteredActions = trimmedQuery
      ? actionItems.filter((item) => matches(item.label, trimmedQuery))
      : actionItems;
    const result: PaletteGroup[] = [];
    if (filteredActions.length > 0) result.push({ label: "Aktionen", items: filteredActions });
    if (filteredNav.length > 0) result.push({ label: "Gehe zu", items: filteredNav });
    if (trimmedQuery.length >= MIN_QUERY_LENGTH && searchItems.length > 0) {
      result.push({ label: "Suchergebnisse", items: searchItems });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, searchResults, canViewSettings]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // Auswahl auf den ersten Treffer zurücksetzen, sobald sich die Eingabe
  // ändert (neue Suchabsicht) – bewusst nicht bei jeder Änderung von
  // `flatItems.length`, damit nachträglich eintreffende Suchergebnisse
  // (derselbe Query) eine bereits per Pfeiltaste gewählte Zeile nicht
  // wegreißen. Render-Zeit-Anpassung statt setState im Effekt, siehe oben.
  const [selectionResetKey, setSelectionResetKey] = useState(trimmedQuery);
  if (trimmedQuery !== selectionResetKey) {
    setSelectionResetKey(trimmedQuery);
    setSelectedIndex(0);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) =>
        flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) void item.onSelect();
    }
  }

  const showEmptyState =
    flatItems.length === 0 &&
    (trimmedQuery.length < MIN_QUERY_LENGTH || !isSearching);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
        showCloseButton={false}
        className="top-24 flex max-h-[70vh] max-w-lg -translate-y-0 flex-col overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Befehlspalette</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Befehl ausführen oder suchen…"
            className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching && trimmedQuery.length >= MIN_QUERY_LENGTH && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Suche…</p>
          )}
          {showEmptyState && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const index = flatItems.indexOf(item);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => void item.onSelect()}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm ${
                      index === selectedIndex
                        ? "bg-muted text-foreground"
                        : "text-foreground/90"
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${item.badge.className}`}
                      >
                        {item.badge.label}
                      </span>
                    )}
                    {item.subtitle && !item.badge && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        </DialogContent>
    </Dialog>
  );
}
