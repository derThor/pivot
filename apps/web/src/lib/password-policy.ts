export interface PasswordPolicy {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
}

export interface PasswordPolicyCheck {
  label: string;
  valid: boolean;
}

export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy,
): PasswordPolicyCheck[] {
  const checks: PasswordPolicyCheck[] = [
    {
      label: `Mindestens ${policy.passwordMinLength} Zeichen`,
      valid: password.length >= policy.passwordMinLength,
    },
  ];
  if (policy.passwordRequireUppercase) {
    checks.push({
      label: "Ein Großbuchstabe",
      valid: /[A-Z]/.test(password),
    });
  }
  if (policy.passwordRequireLowercase) {
    checks.push({
      label: "Ein Kleinbuchstabe",
      valid: /[a-z]/.test(password),
    });
  }
  if (policy.passwordRequireNumber) {
    checks.push({ label: "Eine Ziffer", valid: /[0-9]/.test(password) });
  }
  if (policy.passwordRequireSpecialChar) {
    checks.push({
      label: "Ein Sonderzeichen",
      valid: /[^A-Za-z0-9]/.test(password),
    });
  }
  return checks;
}

export function isPasswordValid(
  password: string,
  policy: PasswordPolicy,
): boolean {
  return checkPasswordPolicy(password, policy).every((check) => check.valid);
}
