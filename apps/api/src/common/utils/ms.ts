const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parst einfache Dauer-Strings wie "15m", "30d" in Millisekunden. */
export default function ms(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Ungültiges Dauerformat: "${duration}"`);
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit];
}
