import { redirect } from "next/navigation";
import { MyAccountView } from "@/components/my-account-view";
import {
  getCurrentUser,
  getMySessions,
  getMyWeeklyStats,
  getPublicSettings,
  getRoles,
} from "@/lib/api-server";

export default async function AccountPage() {
  const [user, publicSettings, roles, weeklyStats, sessions] =
    await Promise.all([
      getCurrentUser(),
      getPublicSettings(),
      getRoles({ pageSize: 100 }),
      getMyWeeklyStats(),
      getMySessions(),
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
      allowEmailChange={publicSettings?.allowEmailChange ?? true}
      allowTwoFactor={publicSettings?.allowTwoFactor ?? true}
      passwordPolicy={passwordPolicy}
      primaryRole={primaryRole}
      weeklyStats={weeklyStats ?? { contentCount: 0, mediaCount: 0 }}
      sessions={sessions ?? []}
    />
  );
}
