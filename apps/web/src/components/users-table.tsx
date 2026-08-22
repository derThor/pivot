"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HighlightText } from "@/components/highlight-text";
import { UserRowActions } from "@/components/user-row-actions";
import { UserRestoreButton } from "@/components/user-restore-button";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { formatName, formatRelativeTime, initials } from "@/lib/utils";
import { mediaUrl } from "@/lib/media";
import { roleBadgeColor } from "@/lib/role-colors";
import type { CurrentUser } from "@/lib/api-server";

export function UsersTable({
  users,
  currentUserId,
  allowTwoFactor,
}: {
  users: CurrentUser[];
  currentUserId: string | undefined;
  allowTwoFactor: boolean;
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
                        {user.avatarUrl && (
                          <AvatarImage src={mediaUrl({ url: user.avatarUrl })} />
                        )}
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
                    <Badge
                      variant="secondary"
                      className={
                        allowTwoFactor && user.twoFactorEnabled
                          ? "gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                          : "gap-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                      }
                    >
                      {allowTwoFactor && user.twoFactorEnabled ? (
                        <ShieldCheck className="size-3" />
                      ) : (
                        <ShieldOff className="size-3" />
                      )}
                      {allowTwoFactor && user.twoFactorEnabled
                        ? "Aktiv"
                        : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.anonymizedAt ?
                      <Badge
                        variant="secondary"
                        className="bg-muted text-muted-foreground"
                      >
                        Anonymisiert
                      </Badge>
                    : user.deletedAt ?
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Gelöscht
                      </Badge>
                    : <Badge
                        variant="secondary"
                        className={
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                        }
                      >
                        {user.isActive ? "Aktiv" : "Deaktiviert"}
                      </Badge>
                    }
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt
                      ? formatRelativeTime(user.lastLoginAt)
                      : "–"}
                  </TableCell>
                  <TableCell>
                    {/* Anonymisierte Konten sind ein Endzustand – nichts
                        mehr zu bearbeiten. Gelöschte (noch nicht
                        anonymisierte) Konten lassen sich nur noch
                        wiederherstellen. */}
                    {user.anonymizedAt ? null
                    : user.deletedAt ?
                      <div className="flex justify-center">
                        <UserRestoreButton
                          userId={user.id}
                          name={formatName(user)}
                        />
                      </div>
                    : <UserRowActions user={user} isSelf={isSelf} />}
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
