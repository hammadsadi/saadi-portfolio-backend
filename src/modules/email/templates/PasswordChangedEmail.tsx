import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface PasswordChangedEmailProps {
  name: string;
}

export const previewProps: PasswordChangedEmailProps = { name: 'Alex' };

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function PasswordChangedEmail({ name }: PasswordChangedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>Your {brand.name} password has been changed successfully</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name}
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>
              Password changed
            </Heading>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '16px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Hi {name}, your password was changed successfully. All existing sessions have been signed out as a security measure.
            </Text>

            <Hr style={{ borderColor: brand.colors.border, margin: '24px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', lineHeight: '1.5', margin: '0 0 8px', fontWeight: '600' }}>
              Didn&apos;t make this change?
            </Text>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', lineHeight: '1.5', margin: '0' }}>
              If you did not change your password, your account may be compromised. Please{' '}
              <Link href={`mailto:${brand.supportEmail}`} style={{ color: brand.colors.primary, textDecoration: 'none' }}>
                contact support
              </Link>
              {' '}immediately and reset your password.
            </Text>
          </Section>

          <Section className="footer-section" style={{ backgroundColor: brand.colors.surface, padding: '20px 40px', textAlign: 'center' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0 0 4px' }}>
              © 2025 {brand.name} ·{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>
            </Text>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '12px', margin: '0' }}>
              This is an automated security notification.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
