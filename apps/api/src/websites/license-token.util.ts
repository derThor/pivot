import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

/**
 * Signiertes, zeitlich begrenztes Lizenz-Token (siehe
 * knowledge-base/platform/master-slave-licensing.md) – vom Master über
 * `signLicenseToken()` ausgestellt, von einer Slave-Installation über
 * `verifyLicenseToken()` geprüft. `seq` ist ein monoton steigender Zähler
 * (verhindert, dass ein altes, noch gültiges Token nach einer späteren
 * Sperre wiederhergestellt wird), `domain` bindet das Token an genau eine
 * Installation.
 */
export interface LicenseTokenPayload {
  domain: string;
  siteId: string;
  status: 'live' | 'development' | 'locked';
  issuedAt: number;
  expiresAt: number;
  seq: number;
}

function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

let cachedPrivateKey: KeyObject | null = null;

/** Nur im Master-Modus gesetzt/gebraucht – siehe .env.example für die
 * Erzeugung. */
function loadPrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;
  const raw = process.env.LICENSE_SIGNING_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      'LICENSE_SIGNING_PRIVATE_KEY ist nicht gesetzt (siehe .env.example).',
    );
  }
  cachedPrivateKey = createPrivateKey({
    key: Buffer.from(raw, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  return cachedPrivateKey;
}

/** Öffentlicher Schlüssel, aus dem privaten abgeleitet – wird beim
 * Registrieren einer neuen Slave-Installation einmalig herausgegeben
 * (siehe WebsitesController.getPublicKey), danach lokal bei der Slave-
 * Installation hinterlegt. */
export function getMasterPublicKeyBase64(): string {
  const publicKey = createPublicKey(loadPrivateKey());
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

export function signLicenseToken(payload: LicenseTokenPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = sign(null, Buffer.from(body), loadPrivateKey());
  return `${body}.${base64url(signature)}`;
}

/** Für den Slave-Modus (spätere Umsetzungsphase) – hier bereits abgelegt,
 * da Master und Slave dieselbe Codebase teilen (`DEPLOYMENT_MODE`-Schalter,
 * kein eigenes Repo). Gibt `null` bei ungültiger Signatur oder Struktur
 * zurück, wirft nie. */
export function verifyLicenseToken(
  token: string,
  publicKeyBase64: string,
): LicenseTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const isValid = verify(
      null,
      Buffer.from(body),
      publicKey,
      fromBase64url(signature),
    );
    if (!isValid) return null;
    return JSON.parse(
      fromBase64url(body).toString('utf8'),
    ) as LicenseTokenPayload;
  } catch {
    return null;
  }
}
