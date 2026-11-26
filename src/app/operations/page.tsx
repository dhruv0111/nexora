import '@/styles/learning.css';
import '@/styles/career.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { authorize, finance, period } from '@/lib/operations/service';
import { ActionForm } from '@/components/learning/action-form';
import { f, options } from '@/components/career/ui';
import { SignOutButton } from '@/components/auth/sign-out-button';
export const dynamic = 'force-dynamic';
export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await getServerSession(authOptions);
  if (!s?.user) redirect('/sign-in');
  if (s.user.forceChange) redirect('/account/change-password');
  if (s.user.role !== 'ADMIN') redirect('/forbidden');
  const id = s.user.id,
    q = await searchParams,
    area =
      q.area ||
      s.user.staffScope?.replace('SUPER_ADMIN', 'overview') ||
      'overview';
  const scope = area === 'overview' || area === 'audit' ? 'ADMIN' : area;
  await authorize(id, scope);
  const db = getDb(),
    { from, to, cohort } = period(q),
    date = { gte: from, lt: to },
    skip =
      (Math.min(10000, Math.max(1, parseInt(q.page || '1') || 1)) - 1) * 20,
    full = !s.user.staffScope || s.user.staffScope === 'SUPER_ADMIN',
    sections = [
      'overview',
      'ADMISSIONS_STAFF',
      'ACADEMIC_STAFF',
      'FINANCE_STAFF',
      'PLACEMENT_STAFF',
      'audit',
      ...(s.user.staffScope === 'SUPER_ADMIN' ? ['SUPER_ADMIN'] : []),
    ];
  const query = new URLSearchParams(
    Object.entries(q).filter(
      (v): v is [string, string] => typeof v[1] === 'string',
    ),
  );
  query.set('page', String(skip / 20 + 2));
  let body;
  if (area === 'overview') {
    const [
      leads,
      apps,
      enrolled,
      active,
      completed,
      employers,
      open,
      interviews,
      offers,
      joined,
      support,
    ] = await Promise.all([
      db.inquiry.count({ where: { createdAt: date } }),
      db.application.count({
        where: {
          courseId: { not: null },
          createdAt: date,
          ...(cohort ? { enrollment: { cohortId: cohort } } : {}),
        },
      }),
      db.application.count({
        where: {
          createdAt: date,
          courseId: { not: null },
          enrollment: {
            ...(cohort ? { cohortId: cohort } : {}),
            status: { in: ['ACTIVE', 'COMPLETED'] },
            payments: {
              some: {
                verifiedAt: { not: null },
                status: 'SUCCEEDED',
                providerRef: { not: null },
                refundedMinor: 0,
              },
            },
          },
        },
      }),
      db.enrollment.groupBy({
        by: ['userId'],
        where: { status: 'ACTIVE', ...(cohort ? { cohortId: cohort } : {}) },
      }),
      db.enrollment.count({
        where: { status: 'COMPLETED', ...(cohort ? { cohortId: cohort } : {}) },
      }),
      db.employer.count({ where: { verificationStatus: 'VERIFIED' } }),
      db.opportunity.count({
        where: {
          status: 'PUBLISHED',
          moderation: 'APPROVED',
          deadline: { gt: new Date() },
          employer: { verificationStatus: 'VERIFIED' },
        },
      }),
      db.hiringInterview.count({ where: { createdAt: date } }),
      db.hiringOutcome.count({ where: { offerVerifiedAt: date } }),
      db.hiringOutcome.count({ where: { joiningVerifiedAt: date } }),
      db.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
    ]);
    body = (
      <>
        <p>
          Admissions conversion uses applications created in the period and
          their current verified enrollments. Cohort selection restricts
          admissions to linked records. Leads and hiring figures are
          organization-wide. Active students, graduates, employers, openings and
          backlog are current snapshots.
        </p>
        <div className="career-stats">
          {Object.entries({
            Leads: leads,
            Applications: apps,
            'Converted applications': enrolled,
            'Admissions conversion': apps
              ? Math.round((enrolled / apps) * 100) + '%'
              : 'No denominator',
            'Active students': active.length,
            'Completed enrollments': completed,
            'Verified employers': employers,
            'Open jobs': open,
            'Interview invitations': interviews,
            'Verified offers': offers,
            'Verified job starts': joined,
            'Open LMS support tickets': support,
          }).map(([k, v]) => (
            <div className="career-stat" key={k}>
              <strong>{v}</strong>
              {k}
            </div>
          ))}
        </div>
        <nav className="career-link-row">
          <Link href="/dashboard/admin/admissions">
            Course publishing and admissions
          </Link>
          <Link href="/dashboard/admin/learning">
            LMS and support operations
          </Link>
          <Link href="/projects">Project delivery</Link>
          <Link href="/career/admin">Hiring, placement and contracts</Link>
        </nav>
      </>
    );
  } else if (area === 'ADMISSIONS_STAFF') {
    const leads = await db.inquiry.findMany({
      where: {
        createdAt: date,
        ...(q.q
          ? { email: { contains: q.q.slice(0, 100), mode: 'insensitive' } }
          : {}),
      },
      include: { contacts: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: 20,
    });
    const duplicates = await db.inquiry.groupBy({
      by: ['email'],
      where: { email: { in: leads.map((l) => l.email) } },
      _count: true,
    });
    body = leads.length ? (
      leads.map((l) => (
        <article className="career-card" key={l.id}>
          <h2>{l.name}</h2>
          <p>
            {l.email} · {l.source} · {l.triageStatus} ·{' '}
            {duplicates.find((x) => x.email === l.email)?._count} matching lead
            records
          </p>
          <p>
            Consent {l.noticeVersion} · {l.consentedAt.toISOString()} ·{' '}
            {l.suppressed ? 'Contact suppressed' : 'Inquiry follow-up only'}
          </p>
          {l.contacts.map((c) => (
            <p key={c.id}>
              {c.createdAt.toISOString()} · {c.note}
            </p>
          ))}
          <details>
            <summary>Update lead</summary>
            <ActionForm
              namespace="operations"
              action="lead"
              values={{ id: l.id }}
              fields={[
                options(
                  'status',
                  'Lead status',
                  ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'],
                  l.triageStatus,
                ),
                f(
                  'ownerId',
                  'Assigned admissions user ID',
                  l.ownerId ?? '',
                  'text',
                  false,
                ),
                f(
                  'followUpAt',
                  'Follow-up time (ISO with offset)',
                  l.followUpAt?.toISOString(),
                  'text',
                  false,
                ),
                f(
                  'applicationRef',
                  'Linked application ID',
                  l.applicationRef ?? '',
                  'text',
                  false,
                ),
                f(
                  'suppressed',
                  'Suppress contact',
                  l.suppressed,
                  'checkbox',
                  false,
                ),
                f(
                  'note',
                  'Contact history or change reason',
                  undefined,
                  'textarea',
                ),
              ]}
              button="Save lead update"
            />
          </details>
        </article>
      ))
    ) : (
      <p>No matching inquiries.</p>
    );
  } else if (area === 'ACADEMIC_STAFF') {
    const [rows, mentors, cohorts] = await Promise.all([
      db.enrollment.findMany({
        where: {
          ...(cohort ? { cohortId: cohort } : {}),
          ...(q.q
            ? { user: { name: { contains: q.q, mode: 'insensitive' } } }
            : {}),
        },
        include: {
          user: { select: { name: true } },
          cohort: { select: { name: true } },
          payments: {
            select: { verifiedAt: true, status: true, refundedMinor: true },
          },
          _count: { select: { lessonProgress: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip,
      }),
      db.mentor.findMany({
        include: {
          user: { select: { name: true } },
          _count: { select: { cohorts: true } },
        },
        take: 100,
      }),
      db.cohort.findMany({ take: 100 }),
    ]);
    body = (
      <>
        <h2>Student enrollments</h2>
        {rows.map((e) => (
          <p key={e.id}>
            {e.user.name} · {e.cohort.name} · {e.status} ·{' '}
            {e.payments.some(
              (p) =>
                p.verifiedAt && p.status === 'SUCCEEDED' && !p.refundedMinor,
            )
              ? 'Verified payment'
              : 'No verified collection'}{' '}
            · {e._count.lessonProgress} progress records
          </p>
        ))}
        {!rows.length && <p>No matching student enrollments.</p>}
        <h2>Mentor assignments</h2>
        {mentors.length && cohorts.length ? (
          <ActionForm
            namespace="operations"
            action="mentor"
            fields={[
              {
                name: 'mentorId',
                label: 'Mentor and current cohort workload',
                type: 'select',
                options: mentors.map((m) => ({
                  value: m.id,
                  label:
                    (m.user.name ?? m.id) +
                    ' · ' +
                    m._count.cohorts +
                    ' cohorts',
                })),
              },
              {
                name: 'cohortId',
                label: 'Cohort',
                type: 'select',
                options: cohorts.map((c) => ({ value: c.id, label: c.name })),
              },
              f(
                'availability',
                'Instructor availability',
                undefined,
                'textarea',
              ),
            ]}
            button="Assign mentor"
          />
        ) : (
          <p>No available mentor/cohort pairs.</p>
        )}
      </>
    );
  } else if (area === 'FINANCE_STAFF') {
    const r = await finance(id, from, to, cohort);
    body = (
      <>
        <h2>Verified cash collections</h2>
        <p>
          Amounts are minor currency units, grouped by currency and payment
          creation period. Refunds reflect current provider records. Revenue
          recognition requires an approved accounting policy.
        </p>
        {r.cash.map((c) => (
          <p key={c.currency}>
            {c.currency} · Gross {c._sum.amountMinor} · Refunded{' '}
            {c._sum.refundedMinor} · Net{' '}
            {(c._sum.amountMinor ?? 0) - (c._sum.refundedMinor ?? 0)}
          </p>
        ))}
        {!r.cash.length && <p>No verified collections in this period.</p>}
        <p>{r.failed} failed payments</p>
        {r.obligations.map((v, i) => (
          <p key={i}>
            Outstanding active reservations: {v.currency} {v._sum.amountMinor}
          </p>
        ))}
        <a
          href={
            '/api/operations/finance?' +
            new URLSearchParams({
              from: from.toISOString(),
              to: to.toISOString(),
              cohort,
            })
          }
        >
          Export financial report (JSON)
        </a>
        <h2>Refund requests</h2>
        {r.refunds.map((x) => (
          <p key={x.id}>
            {x.paymentId} · {x.amountMinor} · {x.status}
          </p>
        ))}
        <ActionForm
          namespace="operations"
          action="refund"
          fields={[
            f('paymentId', 'Verified payment ID'),
            f('amountMinor', 'Requested amount in minor units', 1, 'number'),
            f('reason', 'Adjustment reason', undefined, 'textarea'),
            f(
              'confirm',
              'Record refund liability for review',
              false,
              'checkbox',
              true,
            ),
          ]}
          button="Record refund request"
        />
      </>
    );
  } else if (area === 'PLACEMENT_STAFF') {
    const rows = await db.employer.findMany({
      where: q.q ? { companyName: { contains: q.q, mode: 'insensitive' } } : {},
      orderBy: { registeredAt: 'desc' },
      take: 20,
      skip,
      include: { _count: { select: { opportunities: true } } },
    });
    const statuses = await db.partnerStatus.findMany({
      where: { employerId: { in: rows.map((r) => r.id) } },
    });
    body = rows.length ? (
      rows.map((e) => (
        <article className="career-card" key={e.id}>
          <h2>{e.companyName}</h2>
          <p>
            {e.verificationStatus} · {e._count.opportunities} openings recorded
            ·{' '}
            {statuses.find((s) => s.employerId === e.id)?.status ??
              'No partnership recorded'}
          </p>
          {e.verificationStatus === 'VERIFIED' && (
            <ActionForm
              namespace="operations"
              action="partner"
              values={{ employerId: e.id }}
              fields={[
                options('status', 'Partnership status', [
                  'PROSPECT',
                  'SIGNED',
                  'ENDED',
                ]),
                f(
                  'reference',
                  'Agreement evidence or change reason',
                  undefined,
                  'textarea',
                ),
              ]}
              button="Save partner status"
            />
          )}
        </article>
      ))
    ) : (
      <p>No matching companies.</p>
    );
  } else if (area === 'audit') {
    const rows = await db.auditLog.findMany({
      where: { createdAt: date },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip,
    });
    body = (
      <>
        {rows.map((r) => (
          <p key={r.id}>
            {r.createdAt.toISOString()} · {r.action} · {r.actorId ?? 'System'} ·{' '}
            {r.entityType} {r.entityId}
          </p>
        ))}
      </>
    );
  } else if (area === 'SUPER_ADMIN')
    body = (
      <ActionForm
        namespace="operations"
        action="account"
        fields={[
          f('userId', 'Account ID'),
          options('decision', 'Account action', [
            'REVOKE',
            'DISABLE',
            'ENABLE',
            'ADMISSIONS_STAFF',
            'ACADEMIC_STAFF',
            'FINANCE_STAFF',
            'PLACEMENT_STAFF',
          ]),
          f('reason', 'Audit reason', undefined, 'textarea'),
          f(
            'confirm',
            'Confirm account change and revoke sessions',
            false,
            'checkbox',
            true,
          ),
        ]}
        button="Apply account control"
      />
    );
  return (
    <main id="main" className="career-shell">
      <aside className="career-sidebar">
        <strong>NEXORA Operations</strong>
        <nav>
          {sections
            .filter((v) => full || v === s.user.staffScope)
            .map((v) => (
              <Link href={'/operations?area=' + v} key={v}>
                {v.replaceAll('_', ' ')}
              </Link>
            ))}
          <Link href="/account/security">Account security</Link>
        </nav>
        <SignOutButton />
      </aside>
      <div className="career-content">
        <h1>
          {area === 'overview'
            ? 'Executive overview'
            : area.replaceAll('_', ' ')}
        </h1>
        <form className="career-filter">
          <input type="hidden" name="area" value={area} />
          <label>
            From (UTC)
            <input
              name="from"
              type="date"
              defaultValue={from.toISOString().slice(0, 10)}
            />
          </label>
          <label>
            To (exclusive UTC)
            <input
              name="to"
              type="date"
              defaultValue={to.toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Cohort ID
            <input name="cohort" defaultValue={cohort} />
          </label>
          <label>
            Search
            <input name="q" defaultValue={q.q} />
          </label>
          <button className="button button-secondary">Apply filters</button>
        </form>
        {body}
        <p>
          <Link href={'/operations?' + query.toString()}>Next page</Link>
        </p>
      </div>
    </main>
  );
}
