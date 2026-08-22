import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateSecret as generateOtpSecret,
  generateURI as generateOtpUri,
  verify as verifyOtp,
} from 'otplib';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import {
  decryptSecret as decryptSecretWithKey,
  encryptSecret as encryptSecretWithKey,
} from '../../common/utils/secret-encryption';

const RECOVERY_CODE_COUNT = 10;
const ISSUER = 'Pivot CMS';
// ±1 Zeitschritt Toleranz für Uhr-Drift zwischen Server und Authenticator-App
// (RFC 6238 empfiehlt genau das, statt exakter Übereinstimmung).
const EPOCH_TOLERANCE_SECONDS = 30;

@Injectable()
export class TwoFactorService {
  constructor(private readonly config: ConfigService) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
  }

  generateSecret(): string {
    return generateOtpSecret();
  }

  encryptSecret(secret: string): string {
    return encryptSecretWithKey(secret, this.encryptionKey);
  }

  decryptSecret(encrypted: string): string {
    return decryptSecretWithKey(encrypted, this.encryptionKey);
  }

  async buildQrCodeDataUrl(secret: string, email: string): Promise<string> {
    const otpauthUrl = generateOtpUri({ issuer: ISSUER, label: email, secret });
    return QRCode.toDataURL(otpauthUrl);
  }

  async verifyCode(secret: string, code: string): Promise<boolean> {
    try {
      const result = await verifyOtp({
        secret,
        token: code,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
      });
      return result.valid;
    } catch {
      // otplib wirft z.B. bei falscher Länge (TokenLengthError) statt
      // { valid: false } zurückzugeben – hier landen u.a. 10-stellige
      // Recovery-Codes, die absichtlich denselben Eingabepfad wie ein
      // TOTP-Code durchlaufen (siehe AuthService.loginWithTwoFactor()).
      // Jede Art von "kein gültiger TOTP-Code" ist gleichbedeutend mit
      // false, nicht mit einem 500er.
      return false;
    }
  }

  generateRecoveryCodes(): string[] {
    // 5 Byte -> 10 Hex-Zeichen, kompakt genug zum Abtippen/Aufschreiben.
    return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(5).toString('hex'),
    );
  }

  hashRecoveryCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => argon2.hash(code)));
  }

  // Einmal-Codes: liefert den Index des Treffers (zum Entfernen aus dem
  // Array), -1 wenn keiner passt.
  async matchRecoveryCode(
    hashedCodes: string[],
    code: string,
  ): Promise<number> {
    for (let i = 0; i < hashedCodes.length; i += 1) {
      if (await argon2.verify(hashedCodes[i], code)) {
        return i;
      }
    }
    return -1;
  }
}
