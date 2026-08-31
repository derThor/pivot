"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { asset, bff } from "@/lib/bff";

// Durchgängig sichtbarer Hinweis während "Als Nutzer ansehen" (2b.14,
// Sicherheitsdesign) – macht die Impersonation im UI unübersehbar, "Zurück
// zu deinem Konto" stellt die vor dem Start gesicherten Admin-Tokens wieder
// her (siehe /api/auth/stop-impersonation).
export function ImpersonationBanner({ targetName }: { targetName: string }) {
  const [isReturning, setIsReturning] = useState(false);

  async function handleReturn() {
    setIsReturning(true);
    try {
      await fetch(bff("/api/auth/stop-impersonation"), { method: "POST" });
    } finally {
      window.location.assign(asset("/dashboard/users"));
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <Eye className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
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
