import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
const notices = {
  privacy: {
    title: 'Privacy information',
    status: 'Inquiry data notice · inquiry-v1',
    copy: 'The inquiry form stores your name, email address, chosen program, request type, optional message, and consent timestamp in PostgreSQL so the Nexora team can review your request. Do not include sensitive information. The site does not send automated marketing emails or share inquiries with an analytics provider.',
    extra:
      'Spam controls store signed request identifiers and time-windowed, keyed hashes for rate limiting. IP-based limits are enabled only behind a configured trusted proxy. No advertising analytics provider is connected. The formal organization privacy policy, retention schedule, and privacy contact have not been supplied and are not represented as published here. Use the inquiry form to request clarification; submit only if you agree to the specific inquiry use described above.',
  },
  terms: {
    title: 'Terms',
    status: 'Formal enrollment terms not yet published',
    copy: 'This site currently supports program exploration and inquiries. Submitting an inquiry does not create an enrollment, internship, employment, placement, or payment agreement.',
    extra:
      'The organization’s formal terms have not been supplied. Request written program scope, schedule, fees, support availability, and enrollment terms before making a commitment.',
  },
  refund: {
    title: 'Refund Policy',
    status: 'Formal refund policy not yet published',
    copy: 'This website does not currently process payments. No refund period, eligibility condition, or refund promise is being offered on this page.',
    extra:
      'Verified fees, payment arrangements, and the applicable written refund conditions must be provided before any payment. Request these details from the team before enrolling.',
  },
} as const;
export function generateStaticParams() {
  return Object.keys(notices).map((policy) => ({ policy }));
}
export default async function Policy({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!Object.hasOwn(notices, policy)) notFound();
  const notice = notices[policy as keyof typeof notices];
  return (
    <main id="main" className="marketing policy-page">
      <Container>
        <p className="eyebrow">CLEAR INFORMATION. INFORMED DECISIONS.</p>
        <h1>{notice.title}</h1>
        <p className="policy-status">{notice.status}</p>
        <p>{notice.copy}</p>
        <p>{notice.extra}</p>
        <Link href="/interest" className="button button-secondary">
          Ask the team a question
        </Link>
      </Container>
    </main>
  );
}
