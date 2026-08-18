import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * TOTP-Secrets brauchen anders als Passwort-/Token-Hashes den Klartext bei
 * jeder Login-Prüfung zurück – Hashing scheidet aus, also symmetrische
 * Verschlüsselung statt Klartext-Speicherung in der DB. Format:
 * `<iv-hex>:<authTag-hex>:<ciphertext-hex>`.
 */
export function encryptTotpSecret(secret: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptTotpSecret(encrypted: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
