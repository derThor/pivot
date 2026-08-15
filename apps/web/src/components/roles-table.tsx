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
import { RoleRowActions } from "@/components/role-row-actions";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import type { Role } from "@/lib/api-server";

export function RolesTable({
  roles,
  permissionsCatalog,
}: {
  roles: Role[];
  permissionsCatalog: string[];
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam("role-row");
  const deletableIds = roles
    .filter((role) => !role.isSystem && role.userCount === 0)
    .map((role) => role.id);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(deletableIds);

  async function handleBulkDelete() {
    const count = selected.size;
    await Promise.all(
      [...selected].map((id) => fetch(`/api/roles/${id}`, { method: "DELETE" })),
    );
    clear();
    toastDeleted(count === 1 ? "1 Rolle wurde gelöscht." : `${count} Rollen wurden gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectionToolbar
        count={count}
        entityLabelPlural="Rollen"
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
              <TableHead className="min-w-56">Name</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead>Rechte</TableHead>
              <TableHead>Dashboard</TableHead>
              <TableHead>Benutzer</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const canDelete = !role.isSystem && role.userCount === 0;
              return (
                <TableRow key={role.id} id={`role-row-${role.id}`}>
                  <TableCell>
                    {canDelete && (
                      <Checkbox
                        checked={selected.has(role.id)}
                        onCheckedChange={() => toggle(role.id)}
                        aria-label={`${role.name} auswählen`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-56 font-medium">
                    <div className="flex flex-col items-start gap-1">
                      <HighlightText
                        text={role.name}
                        query={highlightQuery}
                        active={activeId === role.id}
                      />
                      {role.isSystem && (
                        <Badge variant="secondary">System</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description}
                  </TableCell>
                  <TableCell>{role.permissions.length}</TableCell>
                  <TableCell>
                    {role.canAccessDashboard ? (
                      "Ja"
                    ) : (
                      <Badge variant="secondary">Kein Zugriff</Badge>
                    )}
                  </TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell>
                    <RoleRowActions
                      role={role}
                      permissionsCatalog={permissionsCatalog}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
