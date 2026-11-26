import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { careerHome } from '@/lib/career/read';
import { displayTime } from '@/lib/learning/policy';
import { CareerShell, CareerForm, f, Status } from '@/components/career/ui';
import { MockForm } from '@/components/career/forms';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await requireRole(['STUDENT', 'EMPLOYER', 'MENTOR', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role };
  if (a.role === 'EMPLOYER') redirect('/career/employer');
  if (a.role === 'ADMIN' || a.role === 'MENTOR') redirect('/career/admin');
  const d = (await careerHome(a))!;
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">BUILD YOUR NEXT CHAPTER</p>
      <h1>Your career, with evidence.</h1>
      <p>
        A clear view of your preparation, applications and next conversations.
      </p>
      <div className="career-link-row">
        <Link href="/career/profile">Build profile & manage sharing</Link>
        <Link href="/career/jobs">Explore job opportunities</Link>
        <Link href="/projects/portfolio">Approved project portfolio</Link>
      </div>
      <div className="career-stats">
        {[
          [d.score.score, 'Readiness / 100'],
          [d.score.approvedPortfolios, 'Approved training portfolios'],
          [d.applications.length, 'Recent applications shown'],
          [d.score.graduates, 'Completed enrollments'],
        ].map(([n, l]) => (
          <div className="career-stat" key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <div className="career-notice">
        {d.score.disclaimer} Course participation and supervised projects are
        training, not professional employment.
      </div>
      <section className="career-card">
        <h2>Your readiness scorecard</h2>
        <p>
          {d.score.review?.ready
            ? 'Staff reviewed: ready to apply'
            : 'Staff review required before applying'}
        </p>
        <ul>
          {Object.entries(d.score.components).map(([k, v]) => (
            <li key={k}>
              {k.replace(/([A-Z])/g, ' $1')}: {v} points
            </li>
          ))}
        </ul>
        <p>
          Assessments 20 · completed enrollment 20 · approved portfolio 20 ·
          mock interview up to 20 · reviewed communication 10 · career
          preparation 10. A staff override replaces the total and records a
          reason.
        </p>
        {d.score.review && <p>Review reason: {d.score.review.reason}</p>}
      </section>
      <div className="career-grid">
        <section className="career-card">
          <h2>Your application pipeline</h2>
          {d.applications.length ? (
            d.applications.map((p) => (
              <article key={p.id}>
                <h3>
                  <Link href={`/career/applications/${p.id}`}>
                    {p.opportunity.title}
                  </Link>
                </h3>
                <p>
                  {p.opportunity.employer.companyName} ·{' '}
                  <Status>{p.status}</Status>
                </p>
                {p.outcome && (
                  <p>
                    Offer:{' '}
                    {p.outcome.offerVerifiedAt ? 'verified' : 'not verified'} ·
                    Joining:{' '}
                    {p.outcome.joiningVerifiedAt ? 'verified' : 'not verified'}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p>
              No job applications yet. Publish your profile and request
              readiness review to begin.
            </p>
          )}
        </section>
        <section className="career-card">
          <h2>Career updates</h2>
          {d.notifications.length ? (
            d.notifications.map((n) => (
              <p key={n.id}>
                <Link href={n.href}>{n.title}</Link> ·{' '}
                {displayTime(n.createdAt)}
              </p>
            ))
          ) : (
            <p>
              No career updates yet. Interview and application updates will
              appear here.
            </p>
          )}
        </section>
        <section className="career-card">
          <h2>Mock interviews</h2>
          <p>
            Practice sessions are separate from employer interviews. All times
            below are IST.
          </p>
          {d.mocks.map((m) => (
            <article key={m.id}>
              <h3>{displayTime(m.startsAt)}</h3>
              <Status>{m.status}</Status>
              <p>
                {m.feedback || 'Feedback pending'}
                {m.score !== null ? ` · Score ${m.score}/100` : ''}
              </p>
              {['REQUESTED', 'CONFIRMED'].includes(m.status) && (
                <details>
                  <summary>Cancel mock interview</summary>
                  <MockForm
                    mock={m}
                    userId={a.id}
                    mentorId={m.mentorId}
                    student
                  />
                </details>
              )}
            </article>
          ))}
          {d.mentors.length ? (
            <details>
              <summary>Request a practice interview</summary>
              {d.mentors.map((m) => (
                <section key={m.id}>
                  <h3>{m.name}</h3>
                  <MockForm userId={a.id} mentorId={m.id} student />
                </section>
              ))}
            </details>
          ) : (
            <p>
              No assigned interview mentor is available. Contact career support.
            </p>
          )}
        </section>
        <section className="career-card">
          <h2>Career support</h2>
          {d.requests.map((r) => (
            <article key={r.id}>
              <h3>{r.subject}</h3>
              <Status>{r.status}</Status>
              <p>{r.message}</p>
              <p>{r.response || 'Awaiting a response.'}</p>
            </article>
          ))}
          <details>
            <summary>Request career support</summary>
            <CareerForm
              action="support"
              values={{ version: 0, status: 'OPEN', response: '' }}
              fields={[
                f('subject', 'Support subject'),
                f('message', 'How can we help?', undefined, 'textarea'),
              ]}
              button="Send support request"
            />
          </details>
        </section>
      </div>
    </CareerShell>
  );
}
