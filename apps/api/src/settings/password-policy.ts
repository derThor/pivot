import type { AppSettings } from '@pivot/database';

export function validatePasswordAgainstPolicy(
  password: string,
  settings: Pick<
    AppSettings,
    | 'passwordMinLength'
    | 'passwordRequireUppercase'
    | 'passwordRequireLowercase'
    | 'passwordRequireNumber'
    | 'passwordRequireSpecialChar'
  >,
): string[] {
  const violations: string[] = [];

  if (password.length < settings.passwordMinLength) {
    violations.push(
      `Mindestens ${settings.passwordMinLength} Zeichen erforderlich.`,
    );
  }
  if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    violations.push('Mindestens ein Großbuchstabe erforderlich.');
  }
  if (settings.passwordRequireLowercase && !/[a-z]/.test(password)) {
    violations.push('Mindestens ein Kleinbuchstabe erforderlich.');
  }
  if (settings.passwordRequireNumber && !/[0-9]/.test(password)) {
    violations.push('Mindestens eine Ziffer erforderlich.');
  }
  if (
    settings.passwordRequireSpecialChar &&
    !/[^A-Za-z0-9]/.test(password)
  ) {
    violations.push('Mindestens ein Sonderzeichen erforderlich.');
  }

  return violations;
}
