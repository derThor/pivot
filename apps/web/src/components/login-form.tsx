"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { bff } from "@/lib/bff";

const loginSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(1, "Passwort ist erforderlich."),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

function redirectAfterLogin(router: ReturnType<typeof useRouter>) {
  const redirectTo =
    new URLSearchParams(window.location.search).get("redirectTo") ??
    "/dashboard";
  router.push(redirectTo);
  router.refresh();
}

export function LoginForm({
  allowRegistration,
  allowPasswordReset,
}: {
  allowRegistration: boolean;
  allowPasswordReset: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<{
    token: string;
    remember: boolean;
  } | null>(null);
  const [code, setCode] = useState("");

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }

      if (data?.mfaRequired) {
        setChallenge({ token: data.challengeToken, remember: values.remember });
        return;
      }

      redirectAfterLogin(router);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/auth/2fa/login-verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: challenge.token,
          code,
          remember: challenge.remember,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Code konnte nicht bestätigt werden.");
        return;
      }

      redirectAfterLogin(router);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (challenge) {
    return (
      <form onSubmit={onSubmitCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="mfa-code">
            Bestätigungscode
          </label>
          <p className="text-sm text-muted-foreground">
            Gib den 6-stelligen Code aus deiner Authenticator-App ein, oder
            einen deiner Recovery-Codes.
          </p>
        </div>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoFocus
          autoComplete="one-time-code"
          maxLength={10}
          className="text-center text-lg tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || code.length < 6}
        >
          {isSubmitting ? "Bestätigt…" : "Bestätigen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setChallenge(null);
            setCode("");
            setError(null);
          }}
        >
          Zurück
        </Button>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@firma.de" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Passwort</FormLabel>
                {allowPasswordReset && (
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Passwort vergessen?
                  </Link>
                )}
              </div>
              <FormControl>
                <PasswordInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remember"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                />
                Angemeldet bleiben (30 Tage)
              </label>
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Anmelden…" : "Anmelden"}
        </Button>
        {allowRegistration && (
          <p className="text-center text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link href="/register" className="text-foreground hover:underline">
              Registrieren
            </Link>
          </p>
        )}
      </form>
    </Form>
  );
}
