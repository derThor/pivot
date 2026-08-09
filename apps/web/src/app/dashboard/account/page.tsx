import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { ChangePasswordForm } from "@/components/change-password-form";
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
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Konto" />

      <AccountForm
        user={user}
        allowEmailChange={publicSettings?.allowEmailChange ?? true}
      />
      <ChangePasswordForm passwordPolicy={passwordPolicy} />
    </div>
  );
}
