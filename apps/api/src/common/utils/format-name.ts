export function formatName(user: {
  firstName?: string | null;
  lastName: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}
