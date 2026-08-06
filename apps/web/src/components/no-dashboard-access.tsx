"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatName } from "@/lib/utils";
import type { CurrentUser } from "@/lib/api-server";

export function NoDashboardAccess({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">Kein Zugriff auf das Backend</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {formatName(user)} (Rolle „{user.role.name}“) hat keinen Zugriff auf
        das Verwaltungs-Dashboard.
      </p>
      <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? "Wird abgemeldet…" : "Abmelden"}
      </Button>
    </div>
  );
}
