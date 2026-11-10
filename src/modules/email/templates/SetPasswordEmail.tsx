import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface SetPasswordEmailProps {
  name: string;
  otp: string;
  expiresInMinutes?: number;
}

export const previewProps: SetPasswordEmailProps = { name: 'Alex', otp: '482916', expiresInMinutes: 10 };

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .otp-box { background-color: #134e4a !important; border-color: #0d9488 !important; }
    .otp-code { color: #5eead4 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function SetPasswordEmail({ name, otp, expiresInMinutes = 10 }: SetPasswordEmailProps) {
  const displayOtp = otp.replace(/(\d{3})(\d{3})/, '$1 $2');

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>{`Your verification code is ${displayOtp} — expires in ${String(expiresInMinutes)} minutes`}</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name}
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>
              Set a password for your account
            </Heading>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px' }}>
              Hi {name}, enter this code to verify your identity and set a password on your {brand.name} account.
            </Text>

            <Section className="otp-box" style={{ backgroundColor: brand.colors.primaryBg, border: `2px solid ${brand.colors.primaryLight}`, borderRadius: '8px', padding: '28px 24px', textAlign: 'center', margin: '0 0 24px' }}>
              <Text className="otp-code" style={{ color: brand.colors.primary, fontFamily: brand.monofont, fontSize: '40px', fontWeight: '700', letterSpacing: '0.35em', margin: '0', lineHeight: '1' }}>
                {displayOtp}
              </Text>
              <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '10px 0 0' }}>
                Expires in {expiresInMinutes} minutes
              </Text>
            </Section>

            <Hr style={{ borderColor: brand.colors.border, margin: '24px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', lineHeight: '1.5', margin: '0' }}>
              If you did not request this, you can safely ignore it. For security, never share this code with anyone.{' '}
              <Link href={`mailto:${brand.supportEmail}`} style={{ color: brand.colors.primary, textDecoration: 'none' }}>
                Contact support
              </Link>{' '}if you have concerns.
            </Text>
          </Section>

          <Section className="footer-section" style={{ backgroundColor: brand.colors.surface, padding: '20px 40px', textAlign: 'center' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0 0 4px' }}>
              © 2025 {brand.name} ·{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>
            </Text>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '12px', margin: '0' }}>
              This is an automated message — please do not reply.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
