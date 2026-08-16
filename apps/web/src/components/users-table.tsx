"use client";

import { ShieldOff } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HighlightText } from "@/components/highlight-text";
import { UserRowActions } from "@/components/user-row-actions";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { formatName, formatRelativeTime, initials } from "@/lib/utils";
import { roleBadgeColor } from "@/lib/role-colors";
import type { CurrentUser } from "@/lib/api-server";

export function UsersTable({
  users,
  currentUserId,
}: {
  users: CurrentUser[];
  currentUserId: string | undefined;
}) {
  const { activeId, query: highlightQuery } = useHighlightParam("user-row");

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead>Benutzer</TableHead>
            <TableHead>2FA</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Zuletzt online</TableHead>
            <TableHead className="text-center">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                Noch keine Benutzer vorhanden.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id} id={`user-row-${user.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar size="lg">
                        <AvatarFallback>{initials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start gap-1.5">
                        <HighlightText
                          text={formatName(user)}
                          query={highlightQuery}
                          active={activeId === user.id}
                        />
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge
                              key={role.id}
                              variant="secondary"
                              className={roleBadgeColor(role.id, role.name)}
                            >
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs font-normal text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Zwei-Faktor-Authentifizierung ist noch nicht gebaut
                        (Nutzervorgabe: Spalte schon mal anlegen, Funktion
                        kommt als eigene Aufgabe danach) – ehrlicher
                        Platzhalter statt erfundenem "aktiviert"-Status. */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex text-muted-foreground/60" />
                        }
                      >
                        <ShieldOff className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Zwei-Faktor-Authentifizierung noch nicht verfügbar
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        user.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
                      }
                    >
                      {user.isActive ? "Aktiv" : "Deaktiviert"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt
                      ? formatRelativeTime(user.lastLoginAt)
                      : "–"}
                  </TableCell>
                  <TableCell>
                    <UserRowActions user={user} isSelf={isSelf} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
