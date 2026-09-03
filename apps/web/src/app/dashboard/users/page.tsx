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
  getLicenseState,
  getPublicSettings,
  getRoles,
  getUsers,
  isModuleActive,
} from "@/lib/api-server";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    role?: string;
    q?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}) {
  const {
    page: pageParam,
    status,
    role,
    q,
    sortBy,
    sortDir: sortDirParam,
  } = await searchParams;
  // Roher Stand der URL für die Paginierungs-Links (siehe buildHref).
  const rawSearchParams = await searchParams;
  const sortDir = sortDirParam === "asc" ? "asc" : "desc";
  const page = Number(pageParam) || 1;
  const roleId = role && role !== "all" ? role : undefined;
  const isActive =
    status === "active" ? true : status === "inactive" ? false : undefined;
  const anonymized = status === "anonymized" ? true : undefined;
  const deleted = status === "deleted" ? true : undefined;

  // `getPublicSettings()` statt `getSettings()`: diese Seite braucht nur
  // `defaultPageSize`/`allowTwoFactor` (App-weites Verhalten, keine
  // sensiblen Daten) – `getSettings()` verlangt `settings:read`, das
  // Administrator seit der Pivot-Rolle nicht mehr hat und wäre sonst
  // still auf den `?? true`/`?? 10`-Fallback zurückgefallen, obwohl der
  // echte Wert etwas anderes sein könnte (Nutzer-Bugreport, 2026-08-22).
  //
  // Performance-Befund, 2026-08-25: `getPublicSettings()` lief vorher
  // ALLEIN vor dem `Promise.all()`, obwohl nur der finale `getUsers()`-
  // Aufruf tatsächlich von `pageSize` abhängt – die restlichen 7 Requests
  // (inkl. der fünf reinen Zähl-Abfragen mit fixem `pageSize: 1`) mussten
  // unnötig auf dieses eine Bein warten. `media/page.tsx` macht es schon
  // richtig: settings-unabhängige Requests in einem Bein, nur der
  // abhängige Aufruf danach.
  const [
    settings,
    currentUser,
    roles,
    allCount,
    activeCount,
    inactiveCount,
    anonymizedCount,
    deletedCount,
    licenseState,
  ] = await Promise.all([
    getPublicSettings(),
    getCurrentUser(),
    // Volle Rollenliste für Auswahl-Dropdown/Filter – bewusst unpaginiert
    // mit großer fester pageSize statt der echten Pagination der
    // Rollen-Seite, siehe knowledge-base/frontend/pagination.md.
    getRoles({ pageSize: 100 }),
    getUsers({ page: 1, pageSize: 1, roleId, q }),
    getUsers({ page: 1, pageSize: 1, roleId, q, isActive: true }),
    getUsers({ page: 1, pageSize: 1, roleId, q, isActive: false }),
    getUsers({ page: 1, pageSize: 1, roleId, q, anonymized: true }),
    getUsers({ page: 1, pageSize: 1, roleId, q, deleted: true }),
    getLicenseState(),
  ]);
  const pageSize = settings?.defaultPageSize ?? 10;
  const datenschutzActive = isModuleActive(licenseState, "datenschutz");
  const users = await getUsers({
    page,
    pageSize,
    roleId,
    isActive,
    anonymized,
    deleted,
    q,
    sortBy,
    sortDir,
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Benutzer" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-button-border"
            render={<Link href="/dashboard/roles" />}
          >
            Rollen verwalten
          </Button>
          {roles && (
            <CreateUserDialog
              roles={roles.items}
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
                anonymized: anonymizedCount?.meta.total ?? 0,
                deleted: deletedCount?.meta.total ?? 0,
              }}
            />
            <UsersTable
              users={users.items}
              currentUserId={currentUser?.id}
              allowTwoFactor={settings?.allowTwoFactor ?? true}
              datenschutzActive={datenschutzActive}
            />
            <PaginationControls
              page={users.meta.page}
              pageCount={users.meta.pageCount}
              // Vorher `?page=${p}` – damit verlor jeder Seitenwechsel
              // Rolle, Status und Suchbegriff. Aus dem echten Stand der URL
              // gebaut bleibt alles erhalten.
              buildHref={(p) => {
                const params = new URLSearchParams(
                  Object.entries(rawSearchParams).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string",
                  ),
                );
                params.set("page", String(p));
                return `?${params.toString()}`;
              }}
            />
          </>
        )}
      </PageContent>
    </div>
  );
}
