import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { CareerShell, CareerForm, f, options } from '@/components/career/ui';
import { displayTime } from '@/lib/learning/policy';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const s = await requireRole(['STUDENT']),
    a = { id: s.user.id, role: s.user.role },
    db = getDb();
  const [p, resumes, consents, history] = await Promise.all([
    db.careerProfile.findUnique({ where: { userId: a.id } }),
    db.careerResume.findMany({
      where: { userId: a.id },
      orderBy: { version: 'desc' },
      take: 20,
    }),
    db.careerConsent.findMany({
      where: { userId: a.id },
      include: { employer: { select: { companyName: true } } },
      take: 50,
    }),
    db.auditLog.findMany({
      where: {
        actorId: a.id,
        action: {
          in: [
            'CAREER_PROFILE_SAVED',
            'CAREER_CONSENT_GRANTED',
            'CAREER_CONSENT_REVOKED',
            'HIRING_APPLICATION_CREATED',
          ],
        },
      },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">YOUR STORY. YOUR CONTROL.</p>
      <h1>Career profile & sharing</h1>
      <div className="career-notice">
        Sharing notice career-v1: Employer visibility permits the verified
        company you apply to or explicitly authorize to view your profile,
        latest resume and approved portfolio. Directory opt-in permits all
        verified employers, subject to readiness eligibility. Contact sharing is
        separate. PUBLIC publishes only your chosen display name, headline,
        self-reported skills and approved portfolio through a public link. Never
        put sensitive information in those fields. Setting PRIVATE withdraws
        future access; copies already downloaded cannot be recalled. Background
        and experience are self-reported. Training must be described separately.
      </div>
      <section className="career-card">
        <h2>Your professional story</h2>
        <CareerForm
          key={p?.version ?? 0}
          action="profile"
          values={{ version: p?.version ?? 0 }}
          fields={[
            f(
              'displayName',
              'Display name',
              p?.displayName ?? s.user.name ?? '',
            ),
            f('headline', 'Professional headline', p?.headline),
            f('summary', 'Career summary', p?.summary, 'textarea'),
            f('education', 'Education', p?.education, 'textarea', false),
            f(
              'background',
              'Actual professional background (exclude training as employment)',
              p?.background,
              'textarea',
              false,
            ),
            f(
              'experienceYears',
              'Actual professional experience in years',
              p?.experienceYears ?? 0,
              'number',
            ),
            f(
              'skills',
              'Self-reported technical skills (one per line)',
              p?.skills.join('\n'),
              'lines',
            ),
            f(
              'preferredRoles',
              'Preferred roles (one per line)',
              p?.preferredRoles.join('\n'),
              'lines',
              false,
            ),
            f(
              'locations',
              'Preferred locations (one per line)',
              p?.locations.join('\n'),
              'lines',
              false,
            ),
            f(
              'workModes',
              'Preferred work arrangements (REMOTE, HYBRID, ONSITE; one per line)',
              p?.workModes.join('\n'),
              'lines',
              false,
            ),
            f('eligibility', 'Work eligibility description', p?.eligibility),
            options(
              'visibility',
              'Profile visibility',
              ['PRIVATE', 'EMPLOYERS', 'PUBLIC'],
              p?.visibility ?? 'PRIVATE',
            ),
            f(
              'shareContact',
              'Share my account email with authorized employers',
              p?.shareContact ?? false,
              'checkbox',
              false,
            ),
            f(
              'seeking',
              'I am seeking work and opt into discovery by verified employers',
              p?.seeking ?? false,
              'checkbox',
              false,
            ),
            f(
              'consent',
              'I accept sharing notice career-v1 for my chosen visibility',
              false,
              'checkbox',
              false,
            ),
          ]}
          button="Save career profile"
        />
        {p?.visibility === 'PUBLIC' && (
          <p>
            <Link href={`/career/public/${a.id}`}>
              View your public portfolio
            </Link>
          </p>
        )}
      </section>
      <div className="career-grid">
        <section className="career-card">
          <h2>Resume versions</h2>
          <p>
            The builder saves immutable text versions of your profile. Only the
            latest active version is shared with authorized employers; private
            contact fields are excluded.
          </p>
          <CareerForm
            action="resume"
            fields={[]}
            button="Create resume version"
          />
          {resumes.map((r) => (
            <article key={r.id}>
              <h3>Resume version {r.version}</h3>
              <p>
                {displayTime(r.createdAt)} ·{' '}
                {r.retiredAt ? 'Retired' : 'Active'}
              </p>
              {!r.retiredAt && (
                <>
                  <p>
                    <a href={`/api/career/resume?id=${r.id}`}>
                      Download resume text
                    </a>
                  </p>
                  <details>
                    <summary>Retire resume version {r.version}</summary>
                    <CareerForm
                      action="retire"
                      values={{ id: r.id, kind: 'RESUME' }}
                      fields={[
                        f(
                          'reason',
                          'Reason for retiring this resume',
                          undefined,
                          'textarea',
                        ),
                      ]}
                      button="Retire resume"
                    />
                  </details>
                </>
              )}
            </article>
          ))}
        </section>
        <section className="career-card">
          <h2>Company sharing controls</h2>
          <p>
            Revoke a company to block its access even while directory discovery
            is enabled. Use PRIVATE to withdraw all sharing.
          </p>
          {consents.length ? (
            consents.map((c) => (
              <article key={c.id}>
                <h3>{c.employer.companyName}</h3>
                <p>
                  {c.revokedAt ? 'Revoked' : 'Granted'} ·{' '}
                  {displayTime(c.grantedAt)}
                </p>
                <CareerForm
                  action="consent"
                  values={{ employerId: c.employerId, grant: !!c.revokedAt }}
                  fields={[]}
                  button={
                    c.revokedAt
                      ? 'Grant company access again'
                      : 'Revoke company access'
                  }
                />
              </article>
            ))
          ) : (
            <p>No company-specific sharing grants yet.</p>
          )}
        </section>
        <section className="career-card">
          <h2>Sharing history</h2>
          {history.map((h) => (
            <p key={h.id}>
              {h.action.replaceAll('_', ' ')} · {displayTime(h.createdAt)}
            </p>
          ))}
        </section>
      </div>
    </CareerShell>
  );
}
