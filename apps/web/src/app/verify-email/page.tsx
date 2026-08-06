import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

async function verifyToken(token: string) {
  const res = await fetch(
    `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, message: body?.message as string | undefined };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await verifyToken(token)
    : { ok: false, message: "Kein Verifikations-Token übergeben." };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.ok ? (
              <CheckCircle2 className="text-primary" />
            ) : (
              <XCircle className="text-destructive" />
            )}
            {result.ok ? "E-Mail bestätigt" : "Verifikation fehlgeschlagen"}
          </CardTitle>
          <CardDescription>
            {result.message ??
              (result.ok
                ? "Deine E-Mail-Adresse wurde erfolgreich bestätigt."
                : "Der Link ist ungültig oder abgelaufen.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/dashboard" />} className="w-full">
            Zum Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
