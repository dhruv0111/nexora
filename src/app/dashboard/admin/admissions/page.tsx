import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Workspace } from '@/components/workspace';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { AdminAction, AdmissionsReview } from '@/components/admin/action';
import { CohortForm } from '@/components/admin/cohort-form';
import { sandboxReady } from '@/lib/payments/gateway';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function Admissions({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  await requireRole(['ADMIN']);
  const params = await searchParams;
  const view = [
    'applications',
    'courses',
    'cohorts',
    'enrollments',
    'payments',
    'inquiries',
    'audit',
  ].includes(params.view ?? '')
    ? params.view!
    : 'applications';
  const db = getDb();
  const courses = await db.course.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      contentApprovedAt: true,
      priceApprovedAt: true,
      version: true,
    },
    orderBy: { title: 'asc' },
    take: 50,
  });
  const applications =
    view === 'applications'
      ? await db.application.findMany({
          where: {
            courseId: { not: null },
            ...(params.status &&
            [
              'SUBMITTED',
              'IN_REVIEW',
              'ASSESSMENT',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'DRAFT',
            ].includes(params.status)
              ? { status: params.status as 'SUBMITTED' }
              : {}),
          },
          include: {
            course: { select: { title: true } },
            user: { select: { email: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        })
      : [];
  const cohorts =
    view === 'cohorts'
      ? await db.cohort.findMany({
          include: {
            course: { select: { title: true } },
            _count: { select: { enrollments: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];
  const enrollments =
    view === 'enrollments'
      ? await db.enrollment.findMany({
          include: {
            cohort: { include: { course: { select: { title: true } } } },
            payments: { select: { id: true, status: true }, take: 3 },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];
  const payments =
    view === 'payments'
      ? await db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
      : [];
  const events =
    view === 'payments'
      ? await db.paymentEvent.findMany({
          orderBy: { receivedAt: 'desc' },
          take: 50,
        })
      : [];
  const inquiries =
    view === 'inquiries'
      ? await db.inquiry.findMany({
          where:
            params.status &&
            ['NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED'].includes(params.status)
              ? { triageStatus: params.status }
              : {},
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];
  const logs =
    view === 'audit'
      ? await db.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : [];
  return (
    <main id="main" className="dashboard-page admissions-admin">
      <div className="dashboard-controls">
        <span>Secure admin operations</span>
        <SignOutButton />
      </div>
      <Workspace role="ADMIN">
        <div className="admin-page-heading">
          <p className="eyebrow">THOUGHTFUL OPERATIONS. CLEAR DECISIONS.</p>
          <h1>Admissions & programs</h1>
          <p>
            Only authorized administrators can publish, approve fees, or review
            applications.
          </p>
        </div>
        <nav className="admin-tabs" aria-label="Admin operations">
          {[
            'applications',
            'courses',
            'cohorts',
            'enrollments',
            'payments',
            'inquiries',
            'audit',
          ].map((tab) => (
            <Link
              key={tab}
              aria-current={view === tab ? 'page' : undefined}
              href={`/dashboard/admin/admissions?view=${tab}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Link>
          ))}
        </nav>
        {view === 'applications' && (
          <>
            <form className="admin-filter" action="/dashboard/admin/admissions">
              <input type="hidden" name="view" value="applications" />
              <label>
                Application status
                <select
                  className="input"
                  name="status"
                  defaultValue={params.status ?? ''}
                >
                  <option value="">All statuses</option>
                  {[
                    'DRAFT',
                    'SUBMITTED',
                    'IN_REVIEW',
                    'ASSESSMENT',
                    'ACCEPTED',
                    'REJECTED',
                    'WAITLISTED',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button className="button button-secondary" type="submit">
                Filter
              </button>
            </form>
            {applications.map((app) => (
              <article className="admin-record" key={app.id}>
                <div className="admin-record-heading">
                  <div>
                    <span className="status-pill">
                      {app.status.replaceAll('_', ' ')}
                    </span>
                    <h2>{app.course?.title}</h2>
                    <p>
                      {app.user.email ?? 'Email unavailable'} · Application{' '}
                      {app.id}
                    </p>
                  </div>
                  <span>Revision {app.version}</span>
                </div>
                <details className="applicant-details">
                  <summary>Read submitted applicant information</summary>
                  <pre>{JSON.stringify(app.details, null, 2)}</pre>
                </details>
                {app.reviewNote && (
                  <p className="admissions-note">
                    Latest feedback: {app.reviewNote}
                  </p>
                )}
                {!['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(app.status) && (
                  <AdmissionsReview
                    id={app.id}
                    version={app.version}
                    status={app.status}
                    assessmentStatus={app.assessmentStatus}
                  />
                )}
              </article>
            ))}
            {!applications.length && (
              <p className="admin-empty">No matching applications.</p>
            )}
          </>
        )}
        {view === 'courses' && (
          <div className="admin-course-list">
            {courses.map((c) => (
              <article className="admin-record" key={c.id}>
                <span className="status-pill">{c.status}</span>
                <h2>{c.title}</h2>
                <p>
                  Content:{' '}
                  {c.contentApprovedAt ? 'Approved' : 'Pending approval'} · Fee:{' '}
                  {c.priceApprovedAt ? 'Approved' : 'Pending approval'}
                </p>
                <Link
                  className="button button-secondary"
                  href={`/dashboard/admin/courses/${c.id}`}
                >
                  Edit course
                </Link>
              </article>
            ))}
          </div>
        )}
        {view === 'cohorts' && (
          <>
            <h2>Create a cohort</h2>
            <p className="admin-help">
              Use actual approved dates. Draft cohorts are not offered at
              checkout.
            </p>
            <CohortForm courses={courses} />
            {cohorts.map((c) => (
              <article className="admin-record" key={c.id}>
                <h2>{c.name}</h2>
                <p>
                  {c.course.title} · {c.status} · capacity{' '}
                  {c.capacity ?? 'Unconfirmed'} · {c._count.enrollments}{' '}
                  enrollment records
                </p>
                <p>
                  {c.startsAt?.toISOString() ?? 'No start date'} —{' '}
                  {c.endsAt?.toISOString() ?? 'No end date'}
                </p>
              </article>
            ))}
          </>
        )}
        {view === 'enrollments' && (
          <>
            {enrollments.map((e) => (
              <article className="admin-record" key={e.id}>
                <span className="status-pill">{e.status}</span>
                <h2>{e.cohort.course.title}</h2>
                <p>
                  {e.cohort.name} · Enrollment {e.id}
                </p>
                {e.reviewReason && (
                  <p className="workflow-notice">
                    {e.reviewReason.replaceAll('_', ' ')}
                  </p>
                )}
                <p>
                  Payments:{' '}
                  {e.payments.map((p) => p.status).join(', ') || 'None'}
                </p>
                {e.status === 'PENDING' && e.payments.length === 0 && (
                  <AdminAction
                    url={`/api/admin/enrollments/${e.id}`}
                    body={{ action: 'cancel-pending' }}
                    label="Cancel pending enrollment"
                  />
                )}
                {e.payments.map((p) => (
                  <AdminAction
                    key={p.id}
                    url={`/api/payments/${p.id}/reconcile`}
                    body={{}}
                    label="Reconcile provider status"
                    disabled={!sandboxReady}
                  />
                ))}
              </article>
            ))}
            {!enrollments.length && (
              <p className="admin-empty">No enrollments yet.</p>
            )}
          </>
        )}
        {view === 'payments' && (
          <>
            <div className="workflow-notice">
              {sandboxReady
                ? 'Sandbox configured. No production payments are enabled.'
                : 'Razorpay test credentials are not configured. Real provider checks are unavailable.'}{' '}
              Refund creation, installments, and financing are disabled.
            </div>
            {payments.map((p) => (
              <article className="admin-record" key={p.id}>
                <span className="status-pill">{p.status}</span>
                <h2>
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: p.currency,
                  }).format(p.amountMinor / 100)}
                </h2>
                <p>
                  Order: {p.providerOrderId ?? 'Unconfirmed'} · Request state:{' '}
                  {p.orderState}
                </p>
                <p>
                  Receipt: {p.providerReceipt ?? 'Legacy record'} · Refunded
                  minor units: {p.refundedMinor}
                </p>
                <AdminAction
                  url={`/api/payments/${p.id}/reconcile`}
                  body={{}}
                  label="Reconcile with Razorpay"
                  disabled={!sandboxReady}
                />
              </article>
            ))}
            <h2>Durable payment events</h2>
            {events.map((e) => (
              <article className="admin-event" key={e.id}>
                <strong>{e.eventType}</strong>
                <span>
                  {e.state} · attempts {e.attempts}
                </span>
                <code>{e.providerEventId}</code>
                {e.reason && <span>{e.reason}</span>}
              </article>
            ))}
          </>
        )}
        {view === 'inquiries' && (
          <>
            <form className="admin-filter" action="/dashboard/admin/admissions">
              <input type="hidden" name="view" value="inquiries" />
              <label>
                Inquiry status
                <select
                  className="input"
                  name="status"
                  defaultValue={params.status ?? ''}
                >
                  <option value="">All</option>
                  {['NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="button button-secondary">
                Filter
              </button>
            </form>
            {inquiries.map((i) => (
              <article className="admin-record" key={i.id}>
                <span className="status-pill">{i.triageStatus}</span>
                <h2>{i.name}</h2>
                <p>
                  {i.email} · {i.program} · {i.intent}
                </p>
                <p>{i.message}</p>
                <p className="admin-help">
                  Consented {i.consentedAt.toISOString()} · {i.noticeVersion}
                </p>
                <div className="workflow-link-row">
                  {['IN_REVIEW', 'CONTACTED', 'CLOSED'].map((s) => (
                    <AdminAction
                      key={s}
                      url={`/api/admin/inquiries/${i.id}`}
                      body={{ status: s }}
                      label={s.replaceAll('_', ' ')}
                    />
                  ))}
                </div>
              </article>
            ))}
            {!inquiries.length && (
              <p className="admin-empty">No matching inquiries.</p>
            )}
          </>
        )}
        {view === 'audit' && (
          <>
            {logs.map((log) => (
              <article key={log.id} className="admin-event">
                <strong>{log.action}</strong>
                <span>
                  {log.entityType} · {log.entityId}
                </span>
                <time dateTime={log.createdAt.toISOString()}>
                  {log.createdAt.toISOString()}
                </time>
                <code>{JSON.stringify(log.metadata)}</code>
              </article>
            ))}
            {!logs.length && (
              <p className="admin-empty">No operational audit events yet.</p>
            )}
          </>
        )}
        <p className="admin-limit-note">
          Views are bounded to the most recent 50 operational records (100 audit
          entries). Use status filters to narrow the review.
        </p>
      </Workspace>
    </main>
  );
}
