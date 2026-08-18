"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleResend() {
    setStatus("sending");
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-300/70 bg-amber-50/70 px-4 py-2 text-sm text-amber-800 backdrop-blur-sm dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <MailWarning className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <span>Bitte bestätige deine E-Mail-Adresse.</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={status !== "idle"}
      >
        {status === "sent"
          ? "Gesendet"
          : status === "sending"
            ? "Sendet…"
            : "Erneut senden"}
      </Button>
    </div>
  );
}
