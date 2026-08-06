import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    this.logger.log(`[Dev-Stub] Verifikations-Mail an ${to}: ${link}`);
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    this.logger.log(`[Dev-Stub] Passwort-Reset-Mail an ${to}: ${link}`);
  }
}
