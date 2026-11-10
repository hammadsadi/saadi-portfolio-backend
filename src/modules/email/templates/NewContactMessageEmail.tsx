import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface NewContactMessageEmailProps {
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
}

export const previewProps: NewContactMessageEmailProps = {
  senderName: 'Jane Smith',
  senderEmail: 'jane@example.com',
  subject: 'Job opportunity',
  message: 'Hi Hammad, I saw your portfolio and wanted to discuss a potential collaboration...',
};

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .message-box { background-color: #1e293b !important; border-left-color: #0d9488 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function NewContactMessageEmail({
  senderName,
  senderEmail,
  subject,
  message,
}: NewContactMessageEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>New contact message from {senderName}: {subject}</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name} — New Message
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '20px', fontWeight: '700', margin: '0 0 20px' }}>
              {subject}
            </Heading>

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', margin: '0 0 4px' }}>From</Text>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', margin: '0 0 16px', fontWeight: '600' }}>
              {senderName}{' '}
              <Link href={`mailto:${senderEmail}`} style={{ color: brand.colors.primary, textDecoration: 'none', fontWeight: '400' }}>
                &lt;{senderEmail}&gt;
              </Link>
            </Text>

            <Hr style={{ borderColor: brand.colors.border, margin: '20px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', margin: '0 0 8px' }}>Message</Text>
            <Section
              className="message-box"
              style={{
                backgroundColor: brand.colors.surface,
                borderLeft: `4px solid ${brand.colors.primary}`,
                padding: '16px 20px',
                borderRadius: '0 6px 6px 0',
                margin: '0 0 24px',
              }}
            >
              <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', lineHeight: '1.7', margin: '0', whiteSpace: 'pre-wrap' }}>
                {message}
              </Text>
            </Section>

            <Link
              href={`mailto:${senderEmail}?subject=Re: ${encodeURIComponent(subject)}`}
              style={{ backgroundColor: brand.colors.primary, color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}
            >
              Reply to {senderName}
            </Link>
          </Section>

          <Section className="footer-section" style={{ backgroundColor: brand.colors.surface, padding: '20px 40px', textAlign: 'center' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0' }}>
              Sent via your portfolio contact form at{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
