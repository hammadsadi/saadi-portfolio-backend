import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface AdminReplyEmailProps {
  recipientName: string;
  originalSubject: string;
  replyMessage: string;
}

export const previewProps: AdminReplyEmailProps = {
  recipientName: 'Jane',
  originalSubject: 'Job opportunity',
  replyMessage: "Hi Jane, thank you for reaching out! I'd love to discuss the opportunity further...",
};

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .reply-box { background-color: #1e293b !important; border-color: #0d9488 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function AdminReplyEmail({
  recipientName,
  originalSubject,
  replyMessage,
}: AdminReplyEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>Reply from {brand.name} regarding: {originalSubject}</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name}
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0 0 4px' }}>
              Re: {originalSubject}
            </Text>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '20px', fontWeight: '700', margin: '0 0 20px' }}>
              Hi {recipientName},
            </Heading>

            <Section
              className="reply-box"
              style={{
                backgroundColor: brand.colors.surface,
                border: `1px solid ${brand.colors.border}`,
                borderRadius: '8px',
                padding: '20px 24px',
                margin: '0 0 24px',
              }}
            >
              <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', lineHeight: '1.7', margin: '0', whiteSpace: 'pre-wrap' }}>
                {replyMessage}
              </Text>
            </Section>

            <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', lineHeight: '1.6', margin: '0 0 4px' }}>
              Best regards,
            </Text>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', fontWeight: '600', margin: '0' }}>
              {brand.name}
            </Text>

            <Hr style={{ borderColor: brand.colors.border, margin: '28px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', lineHeight: '1.5', margin: '0' }}>
              You are receiving this because you submitted a contact request at{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>.
            </Text>
          </Section>

          <Section className="footer-section" style={{ backgroundColor: brand.colors.surface, padding: '20px 40px', textAlign: 'center' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0 0 4px' }}>
              © 2025 {brand.name} ·{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>
            </Text>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '12px', margin: '0' }}>
              This is an automated message — please do not reply to this email.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
