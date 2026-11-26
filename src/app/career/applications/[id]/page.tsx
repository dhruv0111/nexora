import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { applicationRead } from '@/lib/career/read';
import { hiringTransitions } from '@/lib/career/policy';
import { DomainError } from '@/lib/domain/errors';
import { displayTime } from '@/lib/learning/policy';
import {
  CareerShell,
  CareerForm,
  f,
  options,
  Status,
  localDate,
  newDate,
} from '@/components/career/ui';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireRole(['STUDENT', 'EMPLOYER', 'ADMIN']),
    a = { id: s.user.id, role: s.user.role };
  let d;
  try {
    d = await applicationRead(a, (await params).id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }
  const p = d.application,
    student = a.role === 'STUDENT',
    states = (hiringTransitions[p.status] ?? []).filter((v) =>
      student
        ? ['APPLIED', 'WITHDRAWN'].includes(v)
        : !['APPLIED', 'WITHDRAWN', 'OFFERED', 'HIRED'].includes(v),
    );
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">{p.companyName}</p>
      <h1>{p.title}</h1>
      <Status>{p.status}</Status>
      <div className="career-link-row">
        {d.sharing && (
          <Link href={`/career/candidates/${p.userId}`}>
            View authorized career profile
          </Link>
        )}
        {student && <Link href="/career/profile">Manage sharing consent</Link>}
      </div>
      {!d.sharing && !student && (
        <div className="career-notice">
          Candidate sharing is unavailable or withdrawn. Personal profile,
          resume and application statement are blocked. Operational status
          history remains available for recordkeeping.
        </div>
      )}
      <div className="career-grid">
        <section className="career-card">
          <h2>Application</h2>
          <p>
            {p.statement ?? 'Statement hidden because sharing is unavailable.'}
          </p>
          {states.length > 0 &&
            (student || d.sharing || a.role === 'ADMIN') && (
              <CareerForm
                key={p.version}
                action="transition"
                values={{ id: p.id, version: p.version }}
                fields={[
                  options('status', 'Next application stage', [...states]),
                  f('note', 'Reason for status change', undefined, 'textarea'),
                ]}
                button="Update application stage"
              />
            )}
        </section>
        <section className="career-card">
          <h2>Status timeline</h2>
          <ol className="career-timeline">
            {d.history.map((h) => (
              <li key={h.id}>
                <Status>{h.toStatus}</Status>
                <p>{displayTime(h.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="career-card">
        <h2>Employer interviews</h2>
        <p>
          Times display in IST; the saved scheduling timezone is shown
          separately. Invitations and confirmations are stored in NEXORA. Email
          and calendar delivery are not connected.
        </p>
        {d.interviews.map((i) => (
          <article key={i.id}>
            <h3>{i.round}</h3>
            <Status>{i.status}</Status>
            <p>
              {displayTime(i.startsAt)} – {displayTime(i.endsAt)} · {i.timezone}
            </p>
            <p>Candidate availability: {i.availability || 'Not provided'}</p>
            {i.meetingUrl && (
              <p>
                <a
                  href={i.meetingUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Open interview meeting
                </a>
              </p>
            )}
            <p>{i.feedback || 'Candidate feedback pending.'}</p>
            {['REQUESTED', 'CONFIRMED'].includes(i.status) &&
              (student || d.sharing || a.role === 'ADMIN') && (
                <details>
                  <summary>Respond or update {i.round}</summary>
                  <CareerForm
                    action="interview"
                    values={{
                      id: i.id,
                      applicationId: p.id,
                      version: i.version,
                      privateFeedback: '',
                    }}
                    fields={[
                      options(
                        'action',
                        'Interview action',
                        student
                          ? ['CONFIRM', 'AVAILABILITY', 'CANCEL']
                          : ['RESCHEDULE', 'CANCEL', 'COMPLETE'],
                      ),
                      f('round', 'Interview round', i.round),
                      f(
                        'startsAt',
                        'Interview starts (IST)',
                        localDate(i.startsAt),
                        'datetime-local',
                      ),
                      f(
                        'endsAt',
                        'Interview ends (IST)',
                        localDate(i.endsAt),
                        'datetime-local',
                      ),
                      f('timezone', 'Scheduling timezone', i.timezone),
                      f(
                        'availability',
                        'Candidate availability',
                        i.availability,
                        'textarea',
                        false,
                      ),
                      f(
                        'meetingUrl',
                        'HTTPS meeting URL',
                        i.meetingUrl,
                        'url',
                        false,
                      ),
                      f(
                        'feedback',
                        'Candidate-visible interview feedback',
                        i.feedback,
                        'textarea',
                        false,
                      ),
                      ...(!student
                        ? [
                            f(
                              'privateFeedback',
                              'Internal recruiter feedback',
                              ('privateFeedback' in i
                                ? i.privateFeedback
                                : '') as string,
                              'textarea',
                              false,
                            ),
                          ]
                        : []),
                    ]}
                    button="Save interview response"
                  />
                </details>
              )}
          </article>
        ))}
        {!d.interviews.length && <p>No employer interviews scheduled.</p>}
        {!student &&
          (d.sharing || a.role === 'ADMIN') &&
          ['SHORTLISTED', 'INTERVIEW'].includes(p.status) && (
            <details>
              <summary>Invite candidate to an interview</summary>
              <CareerForm
                action="interview"
                values={{
                  applicationId: p.id,
                  version: 0,
                  action: 'REQUEST',
                  availability: '',
                  feedback: '',
                  privateFeedback: '',
                }}
                fields={[
                  f('round', 'Interview round name'),
                  f(
                    'startsAt',
                    'Interview starts (IST)',
                    newDate(),
                    'datetime-local',
                  ),
                  f(
                    'endsAt',
                    'Interview ends (IST)',
                    localDate(new Date(+new Date() + 90000000)),
                    'datetime-local',
                  ),
                  f('timezone', 'Scheduling timezone', 'Asia/Kolkata'),
                  f('meetingUrl', 'HTTPS meeting URL', '', 'url', false),
                ]}
                button="Send interview invitation"
              />
            </details>
          )}
      </section>
      <section className="career-card">
        <h2>Offers and actual joining</h2>
        <p>
          Recorded offer:{' '}
          {d.outcome?.offeredAt ? displayTime(d.outcome.offeredAt) : 'None'} ·
          Offer verification:{' '}
          {d.outcome?.offerVerifiedAt ? 'Verified' : 'Not verified'}
        </p>
        <p>
          Actual joining:{' '}
          {d.outcome?.joinedAt
            ? displayTime(d.outcome.joinedAt)
            : 'Not recorded'}{' '}
          · Joining verification:{' '}
          {d.outcome?.joiningVerifiedAt ? 'Verified' : 'Not verified'}
        </p>
        <p>
          An offer is not a placement. Only separately verified actual joining
          contributes to confirmed starts.
        </p>
        {!student &&
          (d.sharing || a.role === 'ADMIN') &&
          p.status === 'INTERVIEW' &&
          !d.outcome && (
            <details>
              <summary>Record a genuine offer</summary>
              <CareerForm
                action="outcome"
                values={{
                  applicationId: p.id,
                  version: 0,
                  action: 'RECORD_OFFER',
                }}
                fields={[
                  f(
                    'reference',
                    'Offer reference and evidence locator',
                    undefined,
                    'textarea',
                  ),
                  f(
                    'date',
                    'Actual offer date (IST)',
                    newDate(0),
                    'datetime-local',
                  ),
                  f('note', 'Offer recording rationale', undefined, 'textarea'),
                ]}
                button="Record unverified offer"
              />
            </details>
          )}
        {a.role === 'ADMIN' && p.status === 'OFFERED' && d.outcome && (
          <details>
            <summary>Administratively verify offer or joining</summary>
            <CareerForm
              key={d.outcome.version}
              action="outcome"
              values={{ applicationId: p.id, version: d.outcome.version }}
              fields={[
                options(
                  'action',
                  'Verification action',
                  d.outcome.offerVerifiedAt
                    ? ['VERIFY_JOINING']
                    : ['VERIFY_OFFER'],
                ),
                f(
                  'reference',
                  'Independently checked evidence reference',
                  undefined,
                  'textarea',
                ),
                f(
                  'date',
                  'Actual event date (IST)',
                  newDate(0),
                  'datetime-local',
                ),
                f(
                  'note',
                  'Verification findings and source',
                  undefined,
                  'textarea',
                ),
              ]}
              button="Save verified hiring outcome"
            />
          </details>
        )}
      </section>
    </CareerShell>
  );
}
