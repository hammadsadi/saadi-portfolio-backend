import { render } from '@react-email/render';
import { sendEmail } from './email.service.js';
import { brand } from './brand.js';
import VerifyEmail from './templates/VerifyEmail.js';
import WelcomeEmail from './templates/WelcomeEmail.js';
import ResetPasswordEmail from './templates/ResetPasswordEmail.js';
import PasswordChangedEmail from './templates/PasswordChangedEmail.js';
import NewContactMessageEmail from './templates/NewContactMessageEmail.js';
import AdminReplyEmail from './templates/AdminReplyEmail.js';
import NewFollowerEmail from './templates/NewFollowerEmail.js';
import PostApprovedEmail from './templates/PostApprovedEmail.js';
import PostRejectedEmail from './templates/PostRejectedEmail.js';
import SetPasswordEmail from './templates/SetPasswordEmail.js';
import AccountDeletedEmail from './templates/AccountDeletedEmail.js';

async function renderBoth(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

export async function sendVerifyEmailTemplate(opts: {
  to: string;
  name: string;
  otp: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <VerifyEmail name={opts.name} otp={opts.otp} expiresInMinutes={10} />,
  );
  await sendEmail({ to: opts.to, subject: `Verify your email — ${brand.name}`, html, text });
}

export async function sendWelcomeEmailTemplate(opts: {
  to: string;
  name: string;
}): Promise<void> {
  const { html, text } = await renderBoth(<WelcomeEmail name={opts.name} />);
  await sendEmail({ to: opts.to, subject: `Welcome to ${brand.name}!`, html, text });
}

export async function sendResetPasswordEmailTemplate(opts: {
  to: string;
  name: string;
  otp: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <ResetPasswordEmail name={opts.name} otp={opts.otp} expiresInMinutes={10} />,
  );
  await sendEmail({ to: opts.to, subject: `Reset your password — ${brand.name}`, html, text });
}

export async function sendPasswordChangedEmailTemplate(opts: {
  to: string;
  name: string;
}): Promise<void> {
  const { html, text } = await renderBoth(<PasswordChangedEmail name={opts.name} />);
  await sendEmail({ to: opts.to, subject: `Your ${brand.name} password was changed`, html, text });
}

export async function sendNewContactMessageEmailTemplate(opts: {
  to: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <NewContactMessageEmail
      senderName={opts.senderName}
      senderEmail={opts.senderEmail}
      subject={opts.subject}
      message={opts.message}
    />,
  );
  await sendEmail({
    to: opts.to,
    subject: `[Contact] ${opts.subject} — from ${opts.senderName}`,
    html,
    text,
  });
}

export async function sendAdminReplyEmailTemplate(opts: {
  to: string;
  recipientName: string;
  originalSubject: string;
  replyMessage: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <AdminReplyEmail
      recipientName={opts.recipientName}
      originalSubject={opts.originalSubject}
      replyMessage={opts.replyMessage}
    />,
  );
  await sendEmail({
    to: opts.to,
    subject: `Re: ${opts.originalSubject} — ${brand.name}`,
    html,
    text,
  });
}

export async function sendPostApprovedEmailTemplate(opts: {
  to: string;
  authorName: string;
  postTitle: string;
  postUrl: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <PostApprovedEmail
      authorName={opts.authorName}
      postTitle={opts.postTitle}
      postUrl={opts.postUrl}
    />,
  );
  await sendEmail({ to: opts.to, subject: `Your post "${opts.postTitle}" is now live — ${brand.name}`, html, text });
}

export async function sendPostRejectedEmailTemplate(opts: {
  to: string;
  authorName: string;
  postTitle: string;
  reason: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <PostRejectedEmail
      authorName={opts.authorName}
      postTitle={opts.postTitle}
      reason={opts.reason}
    />,
  );
  await sendEmail({ to: opts.to, subject: `Your post "${opts.postTitle}" needs revisions — ${brand.name}`, html, text });
}

export async function sendSetPasswordEmailTemplate(opts: {
  to: string;
  name: string;
  otp: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <SetPasswordEmail name={opts.name} otp={opts.otp} expiresInMinutes={10} />,
  );
  await sendEmail({ to: opts.to, subject: `Set a password for your ${brand.name} account`, html, text });
}

export async function sendAccountDeletedEmailTemplate(opts: {
  to: string;
  name: string;
}): Promise<void> {
  const { html, text } = await renderBoth(<AccountDeletedEmail name={opts.name} />);
  await sendEmail({ to: opts.to, subject: `Your ${brand.name} account has been deleted`, html, text });
}

export async function sendNewFollowerEmailTemplate(opts: {
  to: string;
  recipientName: string;
  followerName: string;
  profileUrl: string;
  unsubscribeUrl: string;
}): Promise<void> {
  const { html, text } = await renderBoth(
    <NewFollowerEmail
      recipientName={opts.recipientName}
      followerName={opts.followerName}
      profileUrl={opts.profileUrl}
      unsubscribeUrl={opts.unsubscribeUrl}
    />,
  );
  await sendEmail({
    to: opts.to,
    subject: `${opts.followerName} is now following you on ${brand.name}`,
    html,
    text,
  });
}
