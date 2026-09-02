import { createHash } from 'node:crypto';

// Have-I-Been-Pwned-Passwort-API (k-Anonymität): nur die ersten 5 Zeichen
// des SHA-1-Hashes werden übertragen, das Klartext-Passwort verlässt den
// Server nie. Antwort ist eine Liste aller Hash-Suffixe mit diesem
// Präfix + Trefferzahl; ein Treffer bedeutet, dass das Passwort in
// bekannten Datenlecks vorkommt (siehe AppSettings.passwordBlockLeaked).
export async function isPasswordLeaked(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  });
  if (!res.ok) {
    // API nicht erreichbar: bewusst nicht blockieren (kein Denial-of-
    // Service für Registrierung/Passwortwechsel durch einen Drittanbieter-
    // Ausfall) – die Prüfung ist eine Zusatzsicherung, keine Kernfunktion.
    return false;
  }
  const body = await res.text();
  return body.split('\n').some((line) => line.split(':')[0]?.trim() === suffix);
}
