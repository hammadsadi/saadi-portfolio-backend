import nodemailer from 'nodemailer';
import { env } from '@/config/env.js';
import { brand } from './brand.js';
import type { EmailProvider, SendEmailOptions } from './email.types.js';

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

class NodemailerProvider implements EmailProvider {
  private readonly transporter;
  private readonly from: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    this.from = `"${brand.name}" <${env.SMTP_USER ?? brand.supportEmail}>`;
  }

  async send(options: SendEmailOptions): Promise<void> {
    await withRetry(async () => {
      await this.transporter.sendMail({ from: this.from, ...options });
    });
  }
}

class ConsoleEmailProvider implements EmailProvider {
  send(options: SendEmailOptions): Promise<void> {
    // Dev fallback — log metadata only, never the body (OTP values may appear there)
    console.info('[email:dev]', JSON.stringify({ to: options.to, subject: options.subject }));
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Singleton — swappable for tests via setEmailProvider()
// ---------------------------------------------------------------------------

let _provider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (_provider) return _provider;
  if (env.SMTP_HOST) {
    _provider = new NodemailerProvider();
  } else {
    if (env.NODE_ENV === 'production') {
      throw new Error('Email service not configured: SMTP_HOST is required in production');
    }
    _provider = new ConsoleEmailProvider();
  }
  return _provider;
}

export function setEmailProvider(provider: EmailProvider): void {
  _provider = provider;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const provider = getProvider();
  console.info('[email] sending', JSON.stringify({ to: options.to, subject: options.subject }));
  try {
    await provider.send(options);
  } catch (err) {
    console.error('[email] failed', JSON.stringify({ to: options.to, subject: options.subject, error: String(err) }));
    throw err;
  }
}
