"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastEdited } from "@/components/app-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/api-server";

export function UserRoleSelect({
  userId,
  roleId,
  roles,
}: {
  userId: string;
  roleId: string;
  roles: Role[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(nextRoleId: string | null) {
    if (!nextRoleId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: nextRoleId }),
      });
      const roleName = roles.find((role) => role.id === nextRoleId)?.name;
      toastEdited(roleName ? `Rolle „${roleName}“ zugewiesen.` : "Die Rolle wurde geändert.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Select
      value={roleId}
      onValueChange={handleChange}
      disabled={isSaving}
      items={Object.fromEntries(roles.map((role) => [role.id, role.name]))}
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
