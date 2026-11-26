import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { administration, placementReport } from '@/lib/career/read';
import { readiness } from '@/lib/career/profile';
import {
  CareerShell,
  CareerForm,
  f,
  options,
  Pager,
  Status,
} from '@/components/career/ui';
import { MockForm } from '@/components/career/forms';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireRole(['ADMIN', 'MENTOR']),
    a = { id: s.user.id, role: s.user.role },
    q = await searchParams,
    d = await administration(a, q),
    admin = a.role === 'ADMIN';
  const from =
      q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)
        ? new Date(q.from)
        : new Date(new Date().getFullYear(), 0, 1),
    to =
      q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)
        ? new Date(q.to)
        : new Date(+new Date() + 86400000),
    report = admin ? await placementReport(a, from, to) : null;
  const documents = admin
      ? await getDb().careerDocument.findMany({
          where: {
            employerId: { in: d.employers.map((e) => e.id) },
            removedAt: null,
          },
          select: { id: true, name: true, employerId: true },
          take: 100,
        })
      : [],
    scores = await Promise.all(d.students.map((u) => readiness(u.id)));
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">TRUST, BEFORE SCALE</p>
      <h1>
        {admin ? 'Placement administration' : 'Career preparation reviews'}
      </h1>
      <p>
        Real opportunities, reviewed readiness, and outcomes supported by
        evidence.
      </p>
      {report && (
        <section className="career-card">
          <h2>Placement reporting</h2>
          <form className="career-filter">
            <label>
              Enrollment/event period from (UTC date, inclusive)
              <input
                name="from"
                type="date"
                defaultValue={from.toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Period to (UTC date, exclusive)
              <input
                name="to"
                type="date"
                defaultValue={to.toISOString().slice(0, 10)}
                required
              />
            </label>
            <button className="button button-secondary">Update report</button>
          </form>
          <p>
            {report.invitations} recorded interview invitations ·{' '}
            {report.verifiedCompanies} currently verified companies reviewed in
            period.
          </p>
          <div
            className="career-table"
            role="region"
            aria-label="Placement outcome report"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {[
                    'Cohort / track',
                    'Enrollments',
                    'Graduates',
                    'Eligible seekers',
                    'Verified offers',
                    'Confirmed starts',
                    'Paid learners (denominator)',
                    'Start conversion',
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.cohortId}>
                    <th scope="row">
                      {r.cohort} · {r.track}
                    </th>
                    <td>{r.enrollments}</td>
                    <td>{r.graduates}</td>
                    <td>{r.seekers}</td>
                    <td>{r.offers}</td>
                    <td>{r.starts}</td>
                    <td>{r.denominator}</td>
                    <td>
                      {r.conversionPercent === null
                        ? 'Not applicable'
                        : `${r.conversionPercent}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!report.rows.length && (
            <p>No enrollment records in the selected reporting period.</p>
          )}
          <details>
            <summary>How this report is calculated</summary>
            <p>{report.definition}</p>
            <p>
              From {report.from} to {report.toExclusive} · as of {report.asOf}.
              Up to 200 cohort groups.
            </p>
          </details>
          <p>
            <a
              href={`/api/career/report?from=${encodeURIComponent(report.from)}&to=${encodeURIComponent(report.toExclusive)}`}
            >
              Download report data
            </a>
          </p>
        </section>
      )}
      <div className="career-grid">
        {admin && (
          <section className="career-card">
            <h2>Employer verification & partner CRM</h2>
            {d.employers.map((e) => (
              <article key={e.id}>
                <h3>{e.companyName}</h3>
                <Status>{e.verificationStatus}</Status>
                <p>
                  {e.website} · {e.businessEmail}
                </p>
                <p>
                  {e.recruiterName} · {e.industry} · {e.location}
                </p>
                <p>{e.requirements}</p>
                <p>{e.reviewNote}</p>
                {documents
                  .filter((x) => x.employerId === e.id)
                  .map((x) => (
                    <p key={x.id}>
                      <a href={`/api/career/document?id=${x.id}`}>
                        Private verification document: {x.name}
                      </a>
                    </p>
                  ))}
                <details>
                  <summary>Review {e.companyName}</summary>
                  <p>
                    Independently validate the company, domain, recruiter
                    authority and genuine hiring needs. A matching email domain
                    is not sufficient.
                  </p>
                  <CareerForm
                    action="employer-review"
                    values={{ employerId: e.id, version: e.version }}
                    fields={[
                      options(
                        'status',
                        'Employer verification decision',
                        e.verificationStatus === 'PENDING_REVIEW'
                          ? ['VERIFIED', 'REJECTED']
                          : e.verificationStatus === 'VERIFIED'
                            ? ['SUSPENDED']
                            : ['PENDING_REVIEW'],
                      ),
                      f(
                        'note',
                        'Verification findings and evidence references',
                        undefined,
                        'textarea',
                      ),
                    ]}
                    button="Record employer review"
                  />
                </details>
              </article>
            ))}
            {!d.employers.length && <p>No registered employers to review.</p>}
          </section>
        )}
        {admin && (
          <section className="career-card">
            <h2>Job moderation</h2>
            {d.jobs.map((j) => (
              <article key={j.id}>
                <h3>{j.title}</h3>
                <p>
                  {j.employer.companyName} · <Status>{j.moderation}</Status>
                </p>
                <p>{j.description}</p>
                <p>
                  {j.skills.join(' · ')} · {j.location} · {j.workMode} ·{' '}
                  {j.employmentType}
                </p>
                <p>
                  Minimum experience {j.minExperience} · {j.eligibility} ·{' '}
                  {j.currency} {j.compensationMin}–{j.compensationMax}
                </p>
                <details>
                  <summary>Moderate {j.title}</summary>
                  <CareerForm
                    action="moderation"
                    values={{ id: j.id, version: j.version }}
                    fields={[
                      options('decision', 'Moderation decision', [
                        'APPROVED',
                        'REJECTED',
                      ]),
                      f(
                        'note',
                        'Moderation findings and legitimacy checks',
                        undefined,
                        'textarea',
                      ),
                    ]}
                    button="Save job moderation"
                  />
                </details>
              </article>
            ))}
            {!d.jobs.length && <p>No openings awaiting moderation.</p>}
          </section>
        )}
      </div>
      <section className="career-card">
        <h2>Student readiness reviews</h2>
        <div className="career-grid">
          {d.students.map((u, i) => (
            <article key={u.id}>
              <h3>{u.name ?? 'Student'}</h3>
              <p>
                {scores[i].score}/100 · {scores[i].paidEnrollmentCount} paid
                enrollments · {scores[i].assessmentPasses} passed assessments ·{' '}
                {scores[i].approvedPortfolios} approved portfolios
              </p>
              <p>
                {scores[i].review?.ready ? 'Ready to apply' : 'Review required'}
              </p>
              {admin && (
                <p>
                  <Link href={`/career/candidates/${u.id}`}>
                    Private admin profile review
                  </Link>
                </p>
              )}
              <details>
                <summary>Review readiness for {u.name ?? u.id}</summary>
                <CareerForm
                  action="readiness"
                  values={{
                    userId: u.id,
                    version: u.careerReadiness?.version ?? 0,
                  }}
                  fields={[
                    f(
                      'ready',
                      'Ready to apply to opportunities',
                      u.careerReadiness?.ready ?? false,
                      'checkbox',
                      false,
                    ),
                    f(
                      'communication',
                      'Communication assessment (0–10)',
                      u.careerReadiness?.communication ?? 0,
                      'number',
                    ),
                    f(
                      'preparation',
                      'Career preparation (0–10)',
                      u.careerReadiness?.preparation ?? 0,
                      'number',
                    ),
                    f(
                      'overrideScore',
                      'Override total (-1 uses calculated score)',
                      u.careerReadiness?.overrideScore ?? -1,
                      'number',
                    ),
                    f(
                      'reason',
                      'Evidence and reason for readiness decision',
                      u.careerReadiness?.reason,
                      'textarea',
                    ),
                  ]}
                  button="Save readiness review"
                />
              </details>
              {admin && d.jobs.some((j) => j.status === 'PUBLISHED') && (
                <details>
                  <summary>Recommend an opening to this student</summary>
                  <CareerForm
                    action="recommend"
                    values={{ userId: u.id }}
                    fields={[
                      {
                        name: 'opportunityId',
                        label: 'Recommended opening',
                        type: 'select',
                        options: d.jobs
                          .filter((j) => j.status === 'PUBLISHED')
                          .map((j) => ({ value: j.id, label: j.title })),
                      },
                      f(
                        'note',
                        'Recommendation rationale',
                        undefined,
                        'textarea',
                      ),
                    ]}
                    button="Send student recommendation"
                  />
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="career-card">
        <h2>Mock interview management</h2>
        {d.mocks.map((m) => (
          <details key={m.id}>
            <summary>
              {m.userId} · {m.status}
            </summary>
            <MockForm mock={m} userId={m.userId} mentorId={m.mentorId} />
          </details>
        ))}
        {!d.mocks.length && <p>No practice interview requests.</p>}
      </section>
      {admin && (
        <>
          <div className="career-grid">
            <section className="career-card">
              <h2>Hiring application oversight</h2>
              {d.applications.map((p) => (
                <p key={p.id}>
                  <Link href={`/career/applications/${p.id}`}>
                    {p.opportunity.title} · {p.status}
                  </Link>
                </p>
              ))}
              {!d.applications.length && <p>No applications recorded.</p>}
            </section>
            <section className="career-card">
              <h2>Career support queue</h2>
              {d.requests.map((r) => (
                <details key={r.id}>
                  <summary>
                    {r.subject} · {r.status}
                  </summary>
                  <p>{r.message}</p>
                  <CareerForm
                    action="support"
                    values={{
                      id: r.id,
                      version: r.version,
                      subject: r.subject,
                      message: r.message,
                    }}
                    fields={[
                      f(
                        'response',
                        'Career support response',
                        r.response,
                        'textarea',
                      ),
                      options(
                        'status',
                        'Support request status',
                        ['OPEN', 'CLOSED'],
                        r.status,
                      ),
                    ]}
                    button="Respond to support request"
                  />
                </details>
              ))}
              {!d.requests.length && <p>No support requests.</p>}
            </section>
          </div>
          <section className="career-card">
            <h2>Recruitment agreement drafts</h2>
            <p>
              Commercial preparation only. Contracts and invoice records remain
              DRAFT; billing and automatic charges are disabled. Students are
              never charged a placement success fee.
            </p>
            {d.contracts.map((c) => (
              <article key={c.id}>
                <h3>{c.reference}</h3>
                <p>
                  {c.feeType} · {c.feeValue} {c.currency} · replacement{' '}
                  {c.replacementDays} days · refund {c.refundDays} days
                </p>
                {c.invoices.map((i) => (
                  <p key={i.id}>
                    Draft invoice {i.reference}: {i.currency} {i.amountMinor}{' '}
                    minor units
                  </p>
                ))}
                <details>
                  <summary>Prepare a draft invoice</summary>
                  <CareerForm
                    action="invoice"
                    values={{ contractId: c.id, currency: c.currency }}
                    fields={[
                      f('reference', 'Unique invoice reference'),
                      f(
                        'amountMinor',
                        'Invoice amount in minor units',
                        0,
                        'number',
                      ),
                    ]}
                    button="Save invoice draft"
                  />
                </details>
              </article>
            ))}
            {d.employers.length > 0 && (
              <details>
                <summary>Prepare a recruitment agreement</summary>
                <CareerForm
                  action="contract"
                  fields={[
                    {
                      name: 'employerId',
                      label: 'Contract employer',
                      type: 'select',
                      options: d.employers.map((e) => ({
                        value: e.id,
                        label: e.companyName,
                      })),
                    },
                    f('reference', 'Unique agreement reference'),
                    options('feeType', 'Recruitment fee type', [
                      'FIXED',
                      'PERCENTAGE',
                    ]),
                    f(
                      'feeValue',
                      'Fixed minor units or percentage basis points',
                      0,
                      'number',
                    ),
                    options('currency', 'Contract currency', [
                      'INR',
                      'USD',
                      'EUR',
                      'GBP',
                    ]),
                    f(
                      'replacementDays',
                      'Contractual replacement window in days',
                      0,
                      'number',
                    ),
                    f(
                      'refundDays',
                      'Contractual refund window in days',
                      0,
                      'number',
                    ),
                  ]}
                  button="Save agreement draft"
                />
              </details>
            )}
          </section>
          <section className="career-card">
            <h2>Privacy retention</h2>
            <p>
              Apply the configured retention window to old resume contents and
              company document bytes. Metadata, consent history and hiring
              outcome records are retained for audit. Review legal retention
              policy before using this control.
            </p>
            <details>
              <summary>Apply configured artifact retention</summary>
              <CareerForm
                action="retention"
                fields={[
                  f(
                    'reason',
                    'Retention action justification',
                    undefined,
                    'textarea',
                  ),
                ]}
                button="Erase expired private artifact contents"
              />
            </details>
          </section>
        </>
      )}
      <Pager page={d.page} base="/career/admin" />
    </CareerShell>
  );
}
