import { RoleFormDialog } from "@/components/role-form-dialog";
import { RolesExplorer, RolesExplorerExportButton } from "@/components/roles-explorer";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { getPermissionsCatalog, getRoles } from "@/lib/api-server";

export default async function RolesPage({
  searchParams,
}: {
  // `highlight` kommt von der globalen Suche (siehe lib/search.ts
  // searchResultHref, generisches Muster für alle Listen-Seiten) – die
  // Split-View kennt kein separates Highlight, wählt den Treffer aber
  // gleichbedeutend als Rolle aus.
  searchParams: Promise<{ role?: string; highlight?: string }>;
}) {
  const { role: roleParam, highlight } = await searchParams;
  const requestedId = roleParam ?? highlight;

  const [roles, permissionsCatalog] = await Promise.all([
    // Split-View statt Pagination (Nutzervorgabe, 2026-08-16, siehe
    // docs/ROADMAP.md 2b.13) – alle Rollen auf einmal, analog zu den
    // Menüs in `/dashboard/navigation`.
    getRoles({ pageSize: 100 }),
    getPermissionsCatalog(),
  ]);

  const roleItems = roles?.items ?? [];
  const selectedRoleId =
    requestedId && roleItems.some((r) => r.id === requestedId)
      ? requestedId
      : (roleItems[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Rollen & Rechte" />
        {permissionsCatalog && (
          <div className="flex items-center gap-2">
            <RolesExplorerExportButton roles={roleItems} />
            <RoleFormDialog permissionsCatalog={permissionsCatalog} />
          </div>
        )}
      </div>

      <PageContent plain>
        {roles === null || permissionsCatalog === null ? (
          <div className="flex h-24 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
            Keine Berechtigung, Rollen zu verwalten.
          </div>
        ) : (
          <RolesExplorer
            roles={roleItems}
            selectedRoleId={selectedRoleId}
            permissionsCatalog={permissionsCatalog}
          />
        )}
      </PageContent>
    </div>
  );
}
