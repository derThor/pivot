// Bewusst kein npm-Paket für UA-Parsing (z.B. `ua-parser-js`) für diese eine
// Anzeige in "Aktive Sitzungen" – ein paar Regex-Heuristiken für die
// gängigsten Fälle reichen, exakte Geräte-/Versionserkennung ist nicht nötig.
export function summarizeUserAgent(
  userAgent: string | null | undefined,
): string {
  if (!userAgent) return 'Unbekanntes Gerät';

  const os =
    (/Windows/.test(userAgent) && 'Windows') ||
    (/iPhone|iPad/.test(userAgent) && 'iOS') ||
    (/Mac OS X/.test(userAgent) && 'macOS') ||
    (/Android/.test(userAgent) && 'Android') ||
    (/Linux/.test(userAgent) && 'Linux') ||
    'Unbekanntes System';

  const browser =
    (/Edg\//.test(userAgent) && 'Edge') ||
    (/OPR\//.test(userAgent) && 'Opera') ||
    (/Chrome\//.test(userAgent) && 'Chrome') ||
    (/CriOS\//.test(userAgent) && 'Chrome') ||
    (/Firefox\//.test(userAgent) && 'Firefox') ||
    (/Safari\//.test(userAgent) && 'Safari') ||
    'Unbekannter Browser';

  return `${os} · ${browser}`;
}
