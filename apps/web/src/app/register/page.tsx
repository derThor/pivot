import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function RegisterPage() {
  const settings = await getPublicSettings();
  const allowRegistration = settings?.allowRegistration ?? true;

  return (
    <AuthShell
      logoUrl={settings?.logoExpandedUrl}
      companyName={settings?.companyName}
      imageUrl={settings?.authImageUrl}
      title="Konto erstellen"
      description="Bitte gib deine Daten ein."
    >
      {allowRegistration ? (
        <RegisterForm
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
      ) : (
        <p className="text-sm text-muted-foreground">
          Die Registrierung ist derzeit deaktiviert.
        </p>
      )}
    </AuthShell>
  );
}
