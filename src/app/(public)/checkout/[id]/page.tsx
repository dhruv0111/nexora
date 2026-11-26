import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import {
  CheckoutForm,
  type FeeReview,
} from '@/components/checkout/checkout-form';
import { applicantPage } from '@/lib/admissions/page-auth';
import { getDb } from '@/lib/db';
import { sandboxReady } from '@/lib/payments/gateway';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function Checkout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const who = await applicantPage(`/checkout/${id}`);
  const app = await getDb().application.findFirst({
    where: { id, userId: who.id },
    include: {
      course: {
        include: {
          cohorts: {
            where: {
              status: 'PUBLISHED',
              admissionsOpen: true,
              startsAt: { gt: new Date() },
            },
            include: {
              _count: {
                select: {
                  enrollments: {
                    where: {
                      OR: [
                        { status: 'ACTIVE' },
                        {
                          status: 'PENDING',
                          reservedUntil: { gt: new Date() },
                        },
                      ],
                    },
                  },
                },
              },
            },
            orderBy: { startsAt: 'asc' },
            take: 10,
          },
        },
      },
      enrollment: {
        include: { payments: { take: 1, orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  if (!app?.course) notFound();
  const c = app.course,
    e = app.enrollment,
    p = e?.payments[0];
  const approved = !!(
    c.status === 'PUBLISHED' &&
    c.contentApprovedAt &&
    c.priceApprovedAt &&
    c.priceMinor !== null &&
    c.termsApprovedAt &&
    c.enrollmentTerms &&
    c.refundPolicy
  );
  const review: FeeReview = {
    applicationId: app.id,
    title: c.title,
    amountMinor: p ? e!.amountMinor : c.priceApprovedAt ? c.priceMinor : null,
    currency: p ? (e!.currency ?? c.currency) : c.currency,
    priceVersion: p ? (e!.priceVersion ?? c.priceVersion) : c.priceVersion,
    termsVersion: p ? e!.termsVersion : c.termsVersion,
    terms: p ? e!.termsSnapshot : c.termsApprovedAt ? c.enrollmentTerms : null,
    refund: p ? e!.refundSnapshot : c.termsApprovedAt ? c.refundPolicy : null,
    accepted: app.status === 'ACCEPTED',
    assessmentPassed:
      !c.assessmentRequired || app.assessmentStatus === 'PASSED',
    approved,
    enabled: sandboxReady,
    existingPaymentId: p?.id ?? null,
    existingEnrollmentId: e?.id ?? null,
    enrollmentStatus: e?.status ?? null,
    cohortId: e?.cohortId ?? null,
    cohorts: c.cohorts.map((h) => ({
      id: h.id,
      name: h.name,
      start: h.startsAt!.toISOString(),
      available: Math.max(0, (h.capacity ?? 0) - h._count.enrollments),
    })),
  };
  return (
    <main id="main" className="checkout-page">
      <Container>
        <div className="checkout-heading">
          <div>
            <p className="eyebrow">REVIEW. AGREE. VERIFY.</p>
            <h1>Your next step, without surprises.</h1>
          </div>
          <span className="status-pill">
            Sandbox only · production disabled
          </span>
        </div>
        <CheckoutForm review={review} />
      </Container>
    </main>
  );
}
