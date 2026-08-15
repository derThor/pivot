import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const settings = await getPublicSettings();

  return (
    <AuthShell title="Neues Passwort" description="Wähle ein neues Passwort.">
      {!token ? (
        <p className="text-sm text-destructive">
          Kein Token übergeben. Bitte fordere einen neuen Link an.
        </p>
      ) : (
        <ResetPasswordForm
          token={token}
          passwordPolicy={
            settings ?? {
              passwordMinLength: 8,
              passwordRequireUppercase: true,
              passwordRequireLowercase: true,
              passwordRequireNumber: true,
              passwordRequireSpecialChar: true,
            }
          }
        />
      )}
    </AuthShell>
  );
}
