"use client";

import { useState } from "react";

import { SystemMessage } from "@/components/ui/system-message";

/** Bewusst nicht dauerhaft (localStorage) weggeklickt – ein fehlschlagender
 * Webhook ist ein aktives Problem, das nach einem Reload wieder sichtbar
 * sein soll, statt versehentlich dauerhaft ausgeblendet zu bleiben. */
export function WebhookFailureBanner({ failingCount }: { failingCount: number }) {
  const [dismissed, setDismissed] = useState(false);

  if (failingCount === 0 || dismissed) return null;

  return (
    <SystemMessage
      variant="error"
      title={`${failingCount} ${failingCount === 1 ? "Webhook schlägt" : "Webhooks schlagen"} fehl`}
      icon={false}
      dismissible
      onDismiss={() => setDismissed(true)}
    />
  );
}
