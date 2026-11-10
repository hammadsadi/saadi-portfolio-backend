import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link, Button,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface WelcomeEmailProps {
  name: string;
}

export const previewProps: WelcomeEmailProps = { name: 'Alex' };

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>Welcome to {brand.name} — your account is ready</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name}
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>
              Welcome, {name}! 🎉
            </Heading>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '16px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Your account has been verified and is ready to use. Explore my portfolio, read the blog, and feel free to reach out.
            </Text>

            <Button
              href={brand.url}
              style={{ backgroundColor: brand.colors.primary, color: '#ffffff', padding: '12px 28px', borderRadius: '6px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}
            >
              Visit Portfolio
            </Button>

            <Hr style={{ borderColor: brand.colors.border, margin: '32px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '14px', lineHeight: '1.5', margin: '0' }}>
              If you did not create this account, please{' '}
              <Link href={`mailto:${brand.supportEmail}`} style={{ color: brand.colors.primary, textDecoration: 'none' }}>
                contact support
              </Link>
              {' '}immediately.
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
