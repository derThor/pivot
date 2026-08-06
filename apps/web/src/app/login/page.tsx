import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function LoginPage() {
  const settings = await getPublicSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Melde dich bei deinem strasev CMS-Konto an.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            allowRegistration={settings?.allowRegistration ?? true}
            allowPasswordReset={settings?.allowPasswordReset ?? true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
