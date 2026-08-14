import { RoleFormDialog } from "@/components/role-form-dialog";
import { RolesTable } from "@/components/roles-table";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import {
  getPermissionsCatalog,
  getPublicSettings,
  getRoles,
} from "@/lib/api-server";

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
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Rollen & Rechte" />
        {permissionsCatalog && (
          <RoleFormDialog permissionsCatalog={permissionsCatalog} />
        )}
      </div>

      <PageContent>
        {roles === null || permissionsCatalog === null ? (
          <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            Keine Berechtigung, Rollen zu verwalten.
          </div>
        ) : (
          <>
            <RolesTable
              roles={roles.items}
              permissionsCatalog={permissionsCatalog}
            />
            <PaginationControls
              page={roles.meta.page}
              pageCount={roles.meta.pageCount}
              buildHref={(p) => `?page=${p}`}
            />
          </>
        )}
      </PageContent>
    </div>
  );
}
