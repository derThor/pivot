"use client";

import { Check, X } from "lucide-react";
import { checkPasswordPolicy, type PasswordPolicy } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

export function PasswordPolicyChecklist({
  password,
  policy,
}: {
  password: string;
  policy: PasswordPolicy;
}) {
  const checks = checkPasswordPolicy(password, policy);

  return (
    <ul className="flex flex-col gap-1">
      {checks.map((check) => (
        <li
          key={check.label}
          className={cn(
            "flex items-center gap-1.5 text-xs",
            check.valid ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {check.valid ? (
            <Check className="size-3 text-primary" />
          ) : (
            <X className="size-3" />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  );
}
