"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrentUser } from "@/lib/api-server";

const roleLabels: Record<CurrentUser["role"], string> = {
  ADMIN: "Administrator",
  EDITOR: "Redakteur",
  AUTHOR: "Autor",
  VIEWER: "Betrachter",
};

export function UserRoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: CurrentUser["role"];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(nextRole: string) {
    setIsSaving(true);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(roleLabels).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
