import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "@/components/register-form";
import { getPublicSettings } from "@/lib/api-server";

export default async function RegisterPage() {
  const settings = await getPublicSettings();
  const allowRegistration = settings?.allowRegistration ?? true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Registrieren</CardTitle>
          <CardDescription>
            Lege ein neues strasev CMS-Konto an.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
