import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { ChangePasswordForm } from "@/components/change-password-form";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Konto</h1>
        <p className="text-sm text-muted-foreground">
          Profil und Passwort verwalten.
        </p>
      </div>

      <AccountForm
        user={user}
        allowEmailChange={publicSettings?.allowEmailChange ?? true}
      />
      <ChangePasswordForm passwordPolicy={passwordPolicy} />
    </div>
  );
}
