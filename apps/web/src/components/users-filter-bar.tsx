"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/api-server";

/** Filter-Leiste über der Benutzer-Tabelle (Nutzervorgabe, 1:1 nach
 * Bildvorlage): Status-Pills (Alle/Aktiv/Deaktiviert/Anonymisiert) sind
 * reine Links (serverseitig gefiltert), Rollen-Dropdown und Suche
 * navigieren per `router.push` mit debounce bei der Suche. "Anonymisiert"
 * ergänzt 2026-08-21 (Nutzervorgabe) – sonst wären anonymisierte Konten
 * nirgends mehr einsehbar, seit `findAll()` sie standardmäßig ausblendet. */
export function UsersFilterBar({
  roles,
  counts,
}: {
  roles: Role[];
  counts: {
    all: number;
    active: number;
    inactive: number;
    anonymized: number;
    deleted: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "all";
  const roleId = searchParams.get("role") ?? "all";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  const statusPills = [
    { value: "all", label: "Alle", count: counts.all },
    { value: "active", label: "Aktiv", count: counts.active },
    { value: "inactive", label: "Deaktiviert", count: counts.inactive },
    { value: "deleted", label: "Gelöscht", count: counts.deleted },
    { value: "anonymized", label: "Anonymisiert", count: counts.anonymized },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-9 items-center gap-1 rounded-xl bg-[#F4F4F5] p-1">
        {statusPills.map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => updateParam("status", pill.value)}
            className={cn(
              "flex h-7 items-center rounded-lg px-3 text-sm font-medium transition-colors",
              status === pill.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {pill.label} {pill.count}
          </button>
        ))}
      </div>

      <Select
        value={roleId}
        onValueChange={(value) => updateParam("role", value)}
        items={{
          all: "Alle Rollen",
          ...Object.fromEntries(roles.map((r) => [r.id, r.name])),
        }}
      >
        <SelectTrigger className="h-9 w-44 rounded-xl data-[size=default]:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Rollen</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex h-9 min-w-56 items-center gap-2 rounded-xl border border-[#D4D4D4] bg-card px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Name oder E-Mail"
          className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
