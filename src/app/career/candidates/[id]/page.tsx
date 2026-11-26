import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { candidate } from '@/lib/career/profile';
import { DomainError } from '@/lib/domain/errors';
import { CareerShell } from '@/components/career/ui';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireRole(['STUDENT', 'EMPLOYER', 'ADMIN']);
  let p;
  try {
    p = await candidate(
      { id: s.user.id, role: s.user.role },
      (await params).id,
    );
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }
  return (
    <CareerShell role={s.user.role}>
      <p className="learn-kicker">CONSENT-CONTROLLED CAREER PROFILE</p>
      <h1>{p.displayName}</h1>
      <p>{p.headline}</p>
      <div className="career-grid">
        <section className="career-card">
          <h2>Career summary</h2>
          <p>{p.summary}</p>
          <h3>Self-reported background</h3>
          <p>
            {p.background || 'Not provided'} · {p.experienceYears} professional
            years
          </p>
          <h3>Education</h3>
          <p>{p.education || 'Not provided'}</p>
          <h3>Self-reported skills</h3>
          <p>{p.skills.join(' · ')}</p>
          <p>Work eligibility: {p.eligibility}</p>
          <p>Preferred roles: {p.preferences.roles.join(' · ')}</p>
          <p>
            {p.preferences.locations.join(' · ')} ·{' '}
            {p.preferences.workModes.join(' · ')}
          </p>
          <p>
            {p.email
              ? `Authorized contact: ${p.email}`
              : 'Contact information is not shared.'}
          </p>
          {p.resume && (
            <a href={`/api/career/resume?id=${p.resume.id}`}>
              Download authorized resume version {p.resume.version}
            </a>
          )}
        </section>
        <section className="career-card">
          <h2>Approved training portfolio</h2>
          <div className="career-notice">
            Mentor-approved supervised training contributions. These are not
            employment, internship or apprenticeship records. Private evidence
            and internal mentor notes are excluded.
          </div>
          {p.portfolio.map((e, i) => (
            <article key={i}>
              <h3>{e.project}</h3>
              <p>{e.description}</p>
              <p>{e.technologies.join(' · ')}</p>
              <p>Challenges: {e.challenges}</p>
              <p>
                Reviewed outcome:{' '}
                {e.outcome || 'No measurable outcome recorded'}
              </p>
            </article>
          ))}
          {!p.portfolio.length && (
            <p>No publication-approved portfolio entries are available.</p>
          )}
        </section>
      </div>
    </CareerShell>
  );
}
