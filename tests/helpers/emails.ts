import type { EmailProvider, SendEmailOptions } from '@/modules/email/email.types.js';

export const sentEmails: SendEmailOptions[] = [];

export const captureEmailProvider: EmailProvider = {
  async send(options: SendEmailOptions): Promise<void> {
    sentEmails.push(options);
  },
};

export function clearSentEmails(): void {
  sentEmails.length = 0;
}

export function lastEmailTo(to: string): SendEmailOptions | undefined {
  return [...sentEmails].reverse().find((e) => e.to === to);
}
