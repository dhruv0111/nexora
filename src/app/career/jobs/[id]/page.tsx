import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { DomainError } from '@/lib/domain/errors';
import { jobRead, matchReasons } from '@/lib/career/read';
import { readiness } from '@/lib/career/profile';
import { exportPortfolio } from '@/lib/projects/evidence';
import { CareerShell, CareerForm, f, Status } from '@/components/career/ui';
import { displayTime } from '@/lib/learning/policy';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireRole(['STUDENT', 'EMPLOYER', 'ADMIN', 'MENTOR']),
    a = { id: s.user.id, role: s.user.role };
  let j;
  try {
    j = await jobRead(a, (await params).id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }
  const p =
      a.role === 'STUDENT'
        ? await getDb().careerProfile.findUnique({ where: { userId: a.id } })
        : null,
    r = p ? await readiness(a.id) : null;
  const approvedPortfolio = p ? await exportPortfolio(a.id) : null;
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">{j.employer.companyName}</p>
      <h1>{j.title}</h1>
      <Status>
        {j.status} · {j.workMode}
      </Status>
      <div className="career-grid">
        <section className="career-card">
          <h2>The opportunity</h2>
          <p>{j.description}</p>
          <p>
            {j.location} · {j.employmentType}
          </p>
          <h3>Requirements</h3>
          <p>{j.skills.join(' · ')}</p>
          <p>
            {j.minExperience} years professional experience · {j.eligibility}
          </p>
          <p>
            {j.compensationMax
              ? `${j.currency} ${j.compensationMin?.toLocaleString()}–${j.compensationMax.toLocaleString()} annually`
              : 'Compensation not disclosed'}
          </p>
          <p>
            Deadline: {j.deadline ? displayTime(j.deadline) : 'Not published'}
          </p>
        </section>
        <section className="career-card">
          <h2>Why this could fit</h2>
          {p && r ? (
            <>
              <ul>
                {matchReasons(p, j, {
                  graduated: r.graduates > 0,
                  assessments: r.assessmentPasses,
                  portfolios: r.approvedPortfolios,
                  approvedTechnologies:
                    approvedPortfolio?.entries.flatMap((e) => e.technologies) ??
                    [],
                }).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p>
                Rules provide explanations only; they never automatically reject
                applicants. Employers validate professional experience and work
                eligibility.
              </p>
            </>
          ) : (
            <p>
              Create your career profile to see transparent matching reasons.
            </p>
          )}
        </section>
      </div>
      {a.role === 'STUDENT' && (
        <section className="career-card">
          <h2>Start your application</h2>
          <p>
            Applying grants this verified employer access to your shared
            profile, latest resume and approved portfolio under career-v1. You
            can revoke access later. A paid enrollment and staff-reviewed
            readiness are required.
          </p>
          <CareerForm
            action="apply"
            values={{ opportunityId: j.id }}
            fields={[
              f(
                'statement',
                'Your application statement',
                undefined,
                'textarea',
              ),
              f(
                'submit',
                'Submit application now (uncheck to save draft)',
                true,
                'checkbox',
                false,
              ),
              f(
                'shareConsent',
                'I consent to share my career profile with this employer',
                false,
                'checkbox',
                true,
              ),
            ]}
            button="Save job application"
          />
        </section>
      )}
    </CareerShell>
  );
}
