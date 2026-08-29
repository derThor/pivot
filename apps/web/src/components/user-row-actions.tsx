"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import type { CurrentUser } from "@/lib/api-server";
import { formatName, truncateMiddle } from "@/lib/utils";

export function UserRowActions({
  user,
  isSelf,
  datenschutzActive,
}: {
  user: CurrentUser;
  isSelf: boolean;
  datenschutzActive: boolean;
}) {
  const router = useRouter();
  const name = formatName(user);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Löscht den Nutzer (setzt User.deletedAt, siehe UsersService.delete) –
  // verschwindet aus dieser Liste, taucht unter Datenschutz → "Nutzer" zur
  // endgültigen Anonymisierung auf (nur wenn `datenschutzActive`, siehe
  // dortiger Kommentar in `UsersService.delete` – sonst anonymisiert das
  // Backend sofort). Sperren (reversibel, bleibt in der Liste) ist bewusst
  // ein eigener Button auf der Bearbeiten-Seite, nicht dieses Papierkorb-
  // Symbol (Nutzer-Bugreport, 2026-08-21: "ich rede von dem mülleimer
  // symbol in der auflistung" – zeigte vorher "deaktiviert").
  async function handleDelete() {
    await fetch(`/api/users/${user.id}/delete`, { method: "POST" });
    toastDeleted(`„${name}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => router.push(`/dashboard/users/${user.id}/edit`)}
        onDelete={!isSelf ? () => setDeleteOpen(true) : undefined}
        editLabel={`„${name}“ bearbeiten`}
        deleteLabel={`„${name}“ löschen`}
      />

      {!isSelf && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`„${truncateMiddle(name)}“ löschen?`}
          description={
            datenschutzActive
              ? "Wird aus der Benutzerliste entfernt und steht unter Datenschutz → „Benutzer“ zur endgültigen Anonymisierung bereit."
              : "Datenschutz ist nicht aktiv: Der Nutzer wird sofort und unwiderruflich anonymisiert, nicht nur gelöscht."
          }
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
