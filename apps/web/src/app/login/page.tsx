import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function LoginPage() {
  const settings = await getPublicSettings();

  return (
    <AuthShell
      title="Willkommen zurück"
      description="Bitte gib deine Zugangsdaten ein."
    >
      <LoginForm
        allowRegistration={settings?.allowRegistration ?? true}
        allowPasswordReset={settings?.allowPasswordReset ?? true}
      />
    </AuthShell>
  );
}
