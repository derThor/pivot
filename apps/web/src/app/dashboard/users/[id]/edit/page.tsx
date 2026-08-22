import { notFound } from "next/navigation";

import { UserEditView } from "@/components/user-edit-view";
import {
  getCurrentUser,
  getPublicSettings,
  getRoles,
  getUser,
  getUserActivity,
  getUserSessions,
  getUserStats,
} from "@/lib/api-server";
import { canChangeEmail } from "@/lib/utils";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // `getPublicSettings()` statt `getSettings()`: diese Seite braucht nur
  // `allowEmailChange`/`allowAdminEmailChange`/`allowTwoFactor` (App-weites
  // Verhalten, keine sensiblen Daten) – `getSettings()` verlangt
  // `settings:read`, das Administrator seit der Pivot-Rolle nicht mehr
  // hat und wäre sonst still auf die `?? true`-Fallbacks zurückgefallen,
  // obwohl die echten Werte etwas anderes sein könnten (Nutzer-Bugreport,
  // 2026-08-22).
  const [user, roles, settings, currentUser, sessions, stats, activity] =
    await Promise.all([
      getUser(id),
      getRoles({ pageSize: 100 }),
      getPublicSettings(),
      getCurrentUser(),
      getUserSessions(id),
      getUserStats(id),
      getUserActivity(id),
    ]);

  if (!user || !roles || !currentUser) {
    notFound();
  }

  return (
    <UserEditView
      user={user}
      roles={roles.items}
      allowEmailChange={canChangeEmail(
        currentUser.roles.map((role) => role.name),
        {
          allowEmailChange: settings?.allowEmailChange ?? true,
          allowAdminEmailChange: settings?.allowAdminEmailChange ?? true,
        },
      )}
      allowTwoFactor={settings?.allowTwoFactor ?? true}
      viewerId={currentUser.id}
      viewerPermissions={currentUser.permissions ?? []}
      viewerIsAdministrator={currentUser.roles.some((role) =>
        ["Administrator", "Pivot"].includes(role.name),
      )}
      viewerIsPivot={currentUser.roles.some((role) => role.name === "Pivot")}
      sessions={sessions ?? []}
      stats={stats ?? { contentCount: 0, mediaCount: 0 }}
      activity={
        activity ?? {
          items: [],
          meta: { page: 1, pageSize: 10, total: 0, pageCount: 0 },
        }
      }
    />
  );
}
