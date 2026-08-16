"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

// Durchgängig sichtbarer Hinweis während "Als Nutzer ansehen" (2b.14,
// Sicherheitsdesign) – macht die Impersonation im UI unübersehbar, "Zurück
// zu deinem Konto" stellt die vor dem Start gesicherten Admin-Tokens wieder
// her (siehe /api/auth/stop-impersonation).
export function ImpersonationBanner({ targetName }: { targetName: string }) {
  const [isReturning, setIsReturning] = useState(false);

  async function handleReturn() {
    setIsReturning(true);
    try {
      await fetch("/api/auth/stop-impersonation", { method: "POST" });
    } finally {
      window.location.assign("/dashboard/users");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" />
        <span>
          Du siehst als <strong>{targetName}</strong>.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReturn}
        disabled={isReturning}
      >
        {isReturning ? "Wechselt zurück…" : "Zurück zu deinem Konto"}
      </Button>
    </div>
  );
}
