import { notFound } from "next/navigation";

import { UserEditView } from "@/components/user-edit-view";
import {
  getCurrentUser,
  getRoles,
  getSettings,
  getUser,
  getUserActivity,
  getUserSessions,
  getUserStats,
} from "@/lib/api-server";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, roles, settings, currentUser, sessions, stats, activity] =
    await Promise.all([
      getUser(id),
      getRoles({ pageSize: 100 }),
      getSettings(),
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
      allowEmailChange={settings?.allowEmailChange ?? true}
      allowTwoFactor={settings?.allowTwoFactor ?? true}
      viewerId={currentUser.id}
      viewerPermissions={currentUser.permissions ?? []}
      viewerIsAdministrator={currentUser.roles.some(
        (role) => role.name === "Administrator",
      )}
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
