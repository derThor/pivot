import { redirect } from "next/navigation";
import { MyAccountView } from "@/components/my-account-view";
import {
  getCurrentUser,
  getMyDeletionRequests,
  getMySessions,
  getMyWeeklyStats,
  getPublicSettings,
  getRoles,
} from "@/lib/api-server";
import { canChangeEmail } from "@/lib/utils";

export default async function AccountPage() {
  const [user, publicSettings, roles, weeklyStats, sessions, myRequests] =
    await Promise.all([
      getCurrentUser(),
      getPublicSettings(),
      getRoles({ pageSize: 100 }),
      getMyWeeklyStats(),
      getMySessions(),
      getMyDeletionRequests(),
    ]);

  if (!user) {
    redirect("/login");
  }

  const passwordPolicy = publicSettings ?? {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecialChar: true,
  };

  const primaryRole =
    roles?.items.find((role) => role.id === user.roles[0]?.id) ?? null;

  return (
    <MyAccountView
      user={user}
      allowEmailChange={canChangeEmail(
        user.roles.map((role) => role.name),
        {
          allowEmailChange: publicSettings?.allowEmailChange ?? true,
          allowAdminEmailChange: publicSettings?.allowAdminEmailChange ?? true,
        },
      )}
      allowTwoFactor={publicSettings?.allowTwoFactor ?? true}
      passwordPolicy={passwordPolicy}
      primaryRole={primaryRole}
      weeklyStats={weeklyStats ?? { contentCount: 0, mediaCount: 0 }}
      sessions={sessions ?? []}
      myDeletionRequests={myRequests ?? []}
    />
  );
}
