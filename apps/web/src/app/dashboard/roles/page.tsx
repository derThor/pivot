import { RoleFormDialog } from "@/components/role-form-dialog";
import { RolesTable } from "@/components/roles-table";
import { PaginationControls } from "@/components/pagination-controls";
import { getPermissionsCatalog, getPublicSettings, getRoles } from "@/lib/api-server";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const [settings, permissionsCatalog] = await Promise.all([
    getPublicSettings(),
    getPermissionsCatalog(),
  ]);
  const roles = await getRoles({
    page,
    pageSize: settings?.defaultPageSize ?? 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rollen & Rechte
          </h1>
          <p className="text-sm text-muted-foreground">
            Definiere, welche Rolle welche Aktionen ausführen darf.
          </p>
        </div>
        {permissionsCatalog && (
          <RoleFormDialog permissionsCatalog={permissionsCatalog} />
        )}
      </div>

      {roles === null || permissionsCatalog === null ? (
        <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          Keine Berechtigung, Rollen zu verwalten.
        </div>
      ) : (
        <>
          <RolesTable roles={roles.items} permissionsCatalog={permissionsCatalog} />
          <PaginationControls
            page={roles.meta.page}
            pageCount={roles.meta.pageCount}
            buildHref={(p) => `?page=${p}`}
          />
        </>
      )}
    </div>
  );
}
