import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function ForgotPasswordPage() {
  const settings = await getPublicSettings();
  const allowed = settings?.allowPasswordReset ?? true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Passwort vergessen</CardTitle>
          <CardDescription>
            Wir senden dir einen Link zum Zurücksetzen deines Passworts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allowed ? (
            <ForgotPasswordForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Passwort-Reset ist derzeit deaktiviert.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
