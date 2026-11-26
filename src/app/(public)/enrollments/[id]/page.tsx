import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { applicantPage } from '@/lib/admissions/page-auth';
import { getDb } from '@/lib/db';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function Enrollment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const who = await applicantPage('/applications');
  const e = await getDb().enrollment.findFirst({
    where: { id, userId: who.id },
    include: {
      cohort: { include: { course: true } },
      payments: {
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          verifiedAt: true,
          providerRef: true,
          refundedMinor: true,
        },
        take: 5,
      },
    },
  });
  if (!e) notFound();
  const active =
    e.status === 'ACTIVE' &&
    e.payments.some(
      (p) => p.status === 'SUCCEEDED' && p.verifiedAt && p.providerRef,
    );
  return (
    <main id="main" className="admissions-page">
      <Container>
        <p className="eyebrow">{e.cohort.course.title}</p>
        <h1>
          {active
            ? 'Your enrollment is active.'
            : e.status === 'REVIEW_REQUIRED'
              ? 'Your enrollment needs review.'
              : 'Your enrollment is not active yet.'}
        </h1>
        <div className="application-status-card">
          <span className="status-pill">{e.status.replaceAll('_', ' ')}</span>
          <h2>{e.cohort.name}</h2>
          <p>
            {active
              ? 'The server has verified a captured payment and activated this enrollment. Learning delivery itself is outside Phase 3.'
              : e.status === 'REVIEW_REQUIRED'
                ? 'A payment or eligibility condition needs operator review. Do not pay again. Access remains blocked until the issue is resolved.'
                : 'No course access is granted from this screen. A verified captured payment and server-approved enrollment are required.'}
          </p>
          <dl>
            {e.payments.map((p) => (
              <div key={p.id}>
                <dt>Payment status</dt>
                <dd>
                  {p.status.replaceAll('_', ' ')} ·{' '}
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: p.currency,
                  }).format(p.amountMinor / 100)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="workflow-link-row">
            <Link href="/applications" className="button button-secondary">
              My applications
            </Link>
            <Link href="/dashboard/student" className="button button-secondary">
              Student workspace
            </Link>
            <Link
              href={`/interest?program=${e.cohort.course.slug}`}
              className="button button-ghost"
            >
              Contact admissions
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
