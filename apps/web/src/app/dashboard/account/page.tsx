import { redirect } from "next/navigation";
import { AccountTabs } from "@/components/account-tabs";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser, getPublicSettings } from "@/lib/api-server";

export default async function AccountPage() {
  const [user, publicSettings] = await Promise.all([
    getCurrentUser(),
    getPublicSettings(),
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

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Konto" />

      <AccountTabs
        user={user}
        allowEmailChange={publicSettings?.allowEmailChange ?? true}
        passwordPolicy={passwordPolicy}
      />
    </div>
  );
}
