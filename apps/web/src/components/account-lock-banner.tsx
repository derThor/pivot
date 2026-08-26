import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Serverseitig statisch (kein "use client" nötig, keine eigene Interaktion
// außer dem Link) – Gegenstück zur middleware.ts-Weiterleitung: die
// Middleware schickt jede Dashboard-Seite außer /dashboard/account hierher
// um, dieser Banner erklärt dem Nutzer dort, warum er hier gelandet ist
// (siehe PasswordChangeGuard/TwoFactorSetupGuard im Backend – ohne
// Erklärung blieben andere Seiten sonst kommentarlos leer).
export function AccountLockBanner({ reason }: { reason: "password" | "2fa" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <span>
          {reason === "password"
            ? "Du musst dein Passwort ändern, bevor du fortfahren kannst."
            : "Du musst die Zwei-Faktor-Authentifizierung einrichten, bevor du fortfahren kannst."}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/dashboard/account" />}
      >
        Jetzt {reason === "password" ? "ändern" : "einrichten"}
      </Button>
    </div>
  );
}
