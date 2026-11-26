import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { applicantPage } from '@/lib/admissions/page-auth';
import { getDb } from '@/lib/db';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function ApplicationStatus({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const who = await applicantPage(`/applications/${id}`);
  const app = await getDb().application.findFirst({
    where: { id, userId: who.id },
    include: { course: true, enrollment: true },
  });
  if (!app || !app.course) notFound();
  const history = await getDb().auditLog.findMany({
    where: {
      entityType: 'Application',
      entityId: id,
      action: { in: ['APPLICATION_SUBMITTED', 'APPLICATION_REVIEWED'] },
    },
    select: { id: true, action: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  return (
    <main id="main" className="admissions-page">
      <Container>
        <Link href="/applications" className="breadcrumb-link">
          My applications
        </Link>
        <p className="eyebrow">{app.course.title}</p>
        <h1>Your next step, clearly.</h1>
        <div className="application-status-card">
          <span className="status-pill">{app.status.replaceAll('_', ' ')}</span>
          <h2>
            {app.status === 'ACCEPTED'
              ? 'Admissions approved. Review the details.'
              : app.status === 'DRAFT'
                ? 'Your draft is waiting for you.'
                : app.status === 'REJECTED'
                  ? 'Your application has been reviewed.'
                  : 'Your application is with admissions.'}
          </h2>
          <p>
            {app.status === 'ACCEPTED'
              ? 'Acceptance is one step. A suitable cohort, approved fees and terms, and verified payment are still required before enrollment becomes active.'
              : 'Your submitted information is stored securely for authorized admissions review. There is no automatic admission or payment.'}
          </p>
          {app.reviewNote && (
            <div className="admissions-note">
              <h3>Admissions feedback</h3>
              <p>{app.reviewNote}</p>
            </div>
          )}
          {app.course.assessmentRequired && (
            <p>
              Prerequisite assessment:{' '}
              <strong>{app.assessmentStatus.replaceAll('_', ' ')}</strong>
            </p>
          )}
          <div className="workflow-link-row">
            {app.status === 'DRAFT' && (
              <Link
                className="button button-primary"
                href={`/apply/${app.course.slug}`}
              >
                Resume draft
              </Link>
            )}
            {app.status === 'ACCEPTED' && (
              <Link
                className="button button-primary"
                href={`/checkout/${app.id}`}
              >
                Review fees & enrollment
              </Link>
            )}
            {app.enrollment && (
              <Link
                className="button button-secondary"
                href={`/enrollments/${app.enrollment.id}`}
              >
                View enrollment status
              </Link>
            )}
            <Link
              href={`/interest?program=${app.course.slug}`}
              className="button button-secondary"
            >
              Contact admissions
            </Link>
          </div>
        </div>
        <section className="application-history">
          <h2>Application history</h2>
          <ol>
            {history.map((event) => (
              <li key={event.id}>
                <span>
                  {event.action === 'APPLICATION_SUBMITTED'
                    ? 'Application submitted'
                    : `Admissions: ${String((event.metadata as Record<string, unknown>).to ?? 'reviewed').replaceAll('_', ' ')}`}
                </span>
                <time dateTime={event.createdAt.toISOString()}>
                  {event.createdAt.toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </li>
            ))}
          </ol>
        </section>
      </Container>
    </main>
  );
}
