import { CreateUserDialog } from "@/components/create-user-dialog";
import { UsersTable } from "@/components/users-table";
import { PageContent } from "@/components/page-content";
import { PageHeader } from "@/components/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import {
  getCurrentUser,
  getRoles,
  getSettings,
  getUsers,
} from "@/lib/api-server";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const settings = await getSettings();
  const [users, currentUser, roles] = await Promise.all([
    getUsers({ page, pageSize: settings?.defaultPageSize ?? 10 }),
    getCurrentUser(),
    // Volle Rollenliste für die Rollen-Auswahl (Dropdown) – bewusst
    // unpaginiert mit großer fester pageSize statt der echten Pagination
    // der Rollen-Seite, siehe knowledge-base/frontend/pagination.md.
    getRoles({ pageSize: 100 }),
  ]);
  const allowEmailChange = settings?.allowEmailChange ?? true;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Benutzer" />
        {roles && settings && (
          <CreateUserDialog roles={roles.items} passwordPolicy={settings} />
        )}
      </div>

      <PageContent>
        {users === null || roles === null ? (
          <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            Keine Berechtigung, Benutzer zu verwalten.
          </div>
        ) : (
          <>
            <UsersTable
              users={users.items}
              currentUserId={currentUser?.id}
              roles={roles.items}
              allowEmailChange={allowEmailChange}
            />
            <PaginationControls
              page={users.meta.page}
              pageCount={users.meta.pageCount}
              buildHref={(p) => `?page=${p}`}
            />
          </>
        )}
      </PageContent>
    </div>
  );
}
