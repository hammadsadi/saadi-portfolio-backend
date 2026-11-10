import {
  Html, Head, Body, Preview, Container, Section,
  Heading, Text, Hr, Link,
} from '@react-email/components';
import { brand } from '../brand.js';

export interface PostRejectedEmailProps {
  authorName: string;
  postTitle: string;
  reason: string;
}

export const previewProps: PostRejectedEmailProps = {
  authorName: 'Alex',
  postTitle: 'Getting Started with TypeScript',
  reason: 'The post needs more detail in the introduction section.',
};

const darkMode = `
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0f172a !important; }
    .container { background-color: #1e293b !important; }
    .text { color: #e2e8f0 !important; }
    .muted { color: #94a3b8 !important; }
    .reason-box { background-color: #1e293b !important; border-color: #334155 !important; }
    .footer-section { background-color: #0f172a !important; }
  }
`;

export default function PostRejectedEmail({ authorName, postTitle, reason }: PostRejectedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkMode}</style>
      </Head>
      <Preview>Your post "{postTitle}" needs revisions before it can be published</Preview>

      <Body className="body" style={{ backgroundColor: brand.colors.surface, fontFamily: brand.fontFamily, margin: '0', padding: '20px 0' }}>
        <Container className="container" style={{ backgroundColor: brand.colors.background, maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          <Section style={{ backgroundColor: brand.colors.primary, padding: '28px 40px' }}>
            <Heading as="h1" style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }}>
              {brand.name}
            </Heading>
          </Section>

          <Section style={{ padding: '40px' }}>
            <Heading as="h2" className="text" style={{ color: brand.colors.text, fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>
              Post needs revisions
            </Heading>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '16px', lineHeight: '1.6', margin: '0 0 8px' }}>
              Hi {authorName},
            </Text>
            <Text className="text" style={{ color: brand.colors.text, fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px' }}>
              Your post <strong>"{postTitle}"</strong> has been reviewed and requires changes before it can be published. It has been returned to your drafts.
            </Text>

            <Section className="reason-box" style={{ backgroundColor: brand.colors.surface, border: `1px solid ${brand.colors.border}`, borderRadius: '6px', padding: '16px 20px', margin: '0 0 24px' }}>
              <Text className="muted" style={{ color: brand.colors.muted, fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                Reviewer Feedback
              </Text>
              <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', lineHeight: '1.6', margin: '0' }}>
                {reason}
              </Text>
            </Section>

            <Text className="text" style={{ color: brand.colors.text, fontSize: '15px', lineHeight: '1.6', margin: '0' }}>
              Please address the feedback and resubmit when ready.
            </Text>

            <Hr style={{ borderColor: brand.colors.border, margin: '32px 0' }} />

            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', lineHeight: '1.5', margin: '0' }}>
              Questions? Reply to this email or contact{' '}
              <Link href={`mailto:${brand.supportEmail}`} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.supportEmail}</Link>.
            </Text>
          </Section>

          <Section className="footer-section" style={{ backgroundColor: brand.colors.surface, padding: '20px 40px', textAlign: 'center' }}>
            <Text className="muted" style={{ color: brand.colors.muted, fontSize: '13px', margin: '0' }}>
              © 2025 {brand.name} ·{' '}
              <Link href={brand.url} style={{ color: brand.colors.primary, textDecoration: 'none' }}>{brand.url}</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
