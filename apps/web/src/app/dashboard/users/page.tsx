import Link from "next/link";

import { CreateUserDialog } from "@/components/create-user-dialog";
import { UsersTable } from "@/components/users-table";
import { UsersFilterBar } from "@/components/users-filter-bar";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<{
    page?: string;
    status?: string;
    role?: string;
    q?: string;
  }>;
}) {
  const { page: pageParam, status, role, q } = await searchParams;
  const page = Number(pageParam) || 1;
  const roleId = role && role !== "all" ? role : undefined;
  const isActive =
    status === "active" ? true : status === "inactive" ? false : undefined;

  const settings = await getSettings();
  const pageSize = settings?.defaultPageSize ?? 10;

  const [users, currentUser, roles, allCount, activeCount, inactiveCount] =
    await Promise.all([
      getUsers({ page, pageSize, roleId, isActive, q }),
      getCurrentUser(),
      // Volle Rollenliste für Auswahl-Dropdown/Filter – bewusst unpaginiert
      // mit großer fester pageSize statt der echten Pagination der
      // Rollen-Seite, siehe knowledge-base/frontend/pagination.md.
      getRoles({ pageSize: 100 }),
      getUsers({ page: 1, pageSize: 1, roleId, q }),
      getUsers({ page: 1, pageSize: 1, roleId, q, isActive: true }),
      getUsers({ page: 1, pageSize: 1, roleId, q, isActive: false }),
    ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Benutzer" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-[#D4D4D4]"
            render={<Link href="/dashboard/roles" />}
          >
            Rollen verwalten
          </Button>
          {roles && settings && (
            <CreateUserDialog
              roles={roles.items}
              passwordPolicy={settings}
              triggerLabel="Benutzer einladen"
            />
          )}
        </div>
      </div>

      <PageContent plain>
        {users === null || roles === null ? (
          <div className="flex h-24 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
            Keine Berechtigung, Benutzer zu verwalten.
          </div>
        ) : (
          <>
            <UsersFilterBar
              roles={roles.items}
              counts={{
                all: allCount?.meta.total ?? 0,
                active: activeCount?.meta.total ?? 0,
                inactive: inactiveCount?.meta.total ?? 0,
              }}
            />
            <div className="rounded-[10px] bg-card shadow-sm">
              <UsersTable users={users.items} currentUserId={currentUser?.id} />
            </div>
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
