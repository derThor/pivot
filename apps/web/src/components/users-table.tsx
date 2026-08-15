"use client";

import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HighlightText } from "@/components/highlight-text";
import { UserRoleSelect } from "@/components/user-role-select";
import { UserRowActions } from "@/components/user-row-actions";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { formatName } from "@/lib/utils";
import type { CurrentUser, Role } from "@/lib/api-server";

export function UsersTable({
  users,
  currentUserId,
  roles,
  allowEmailChange,
}: {
  users: CurrentUser[];
  currentUserId: string | undefined;
  roles: Role[];
  allowEmailChange: boolean;
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam("user-row");
  const deletableIds = users
    .filter((user) => user.id !== currentUserId)
    .map((user) => user.id);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(deletableIds);

  async function handleBulkDelete() {
    const count = selected.size;
    await Promise.all(
      [...selected].map((id) => fetch(`/api/users/${id}`, { method: "DELETE" })),
    );
    clear();
    toastDeleted(count === 1 ? "1 Benutzer wurde gelöscht." : `${count} Benutzer wurden gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectionToolbar
        count={count}
        entityLabelPlural="Benutzer"
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Alle auswählen"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                    <TableCell>
                      {!isSelf && (
                        <Checkbox
                          checked={selected.has(user.id)}
                          onCheckedChange={() => toggle(user.id)}
                          aria-label={`${formatName(user)} auswählen`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <HighlightText
                        text={formatName(user)}
                        query={highlightQuery}
                        active={activeId === user.id}
                      />
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <UserRoleSelect
                        userId={user.id}
                        roleId={user.role.id}
                        roles={roles}
                      />
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
                    <TableCell>
                      <UserRowActions
                        user={user}
                        isSelf={isSelf}
                        allowEmailChange={allowEmailChange}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
