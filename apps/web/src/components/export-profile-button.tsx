"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatName } from "@/lib/utils";
import type { CurrentUser } from "@/lib/api-server";

// Gleiches Muster wie RolesExplorerExportButton (roles-explorer.tsx):
// clientseitiger JSON-Export über einen temporären Blob-Download-Link,
// kein Backend-Endpoint nötig, da alle Daten bereits geladen sind.
// Bewusst nur "persönliche Daten" (keine internen Felder wie
// failedLoginAttempts/permissions/mustChangePassword) – ähnlich einem
// einfachen DSGVO-Datenauszug.
export function ExportProfileButton({ user }: { user: CurrentUser }) {
  function handleExport() {
    const payload = {
      name: formatName(user),
      email: user.email,
      department: user.department,
      phone: user.phone,
      straße: user.street,
      plz: user.postalCode,
      ort: user.city,
      rollen: user.roles.map((role) => role.name),
      status: user.isActive ? "aktiv" : "deaktiviert",
      emailBestätigtAm: user.emailVerifiedAt,
      zweiFaktorAktiv: user.twoFactorEnabled,
      zweiFaktorEingerichtetAm: user.twoFactorEnabledAt,
      erstelltAm: user.createdAt,
      letzterLogin: user.lastLoginAt,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${user.email.replace(/[^a-z0-9.@-]/gi, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="border-[#D4D4D4]"
      onClick={handleExport}
    >
      <Download />
      Daten exportieren
    </Button>
  );
}
