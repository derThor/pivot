import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function ForgotPasswordPage() {
  const settings = await getPublicSettings();
  const allowed = settings?.allowPasswordReset ?? true;

  return (
    <AuthShell
      title="Passwort vergessen"
      description="Wir senden dir einen Link zum Zurücksetzen deines Passworts."
    >
      {allowed ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          Passwort-Reset ist derzeit deaktiviert.
        </p>
      )}
    </AuthShell>
  );
}
