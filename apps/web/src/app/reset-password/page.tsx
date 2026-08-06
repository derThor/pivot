import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Neues Passwort</CardTitle>
          <CardDescription>Wähle ein neues Passwort.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
