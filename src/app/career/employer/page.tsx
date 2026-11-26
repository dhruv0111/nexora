import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { employerHome, candidates } from '@/lib/career/read';
import {
  CareerShell,
  CareerForm,
  f,
  Pager,
  Status,
} from '@/components/career/ui';
import { JobForm } from '@/components/career/forms';
import { CompanyUpload } from '@/components/career/upload';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireRole(['STUDENT', 'EMPLOYER']),
    a = { id: s.user.id, role: s.user.role },
    q = await searchParams,
    has = await getDb().employer.findUnique({ where: { userId: a.id } });
  if (!has)
    return (
      <CareerShell role={a.role}>
        <p className="learn-kicker">MEET PEOPLE WHO BUILD</p>
        <h1>Register your hiring team.</h1>
        <div className="career-notice">
          Company registration uses a separate recruiter account. Existing
          learner records cannot be converted. A matching business email alone
          does not verify your company: a NEXORA administrator must review
          authority, domain and legitimate hiring needs before candidate access
          or publication.
        </div>
        <section className="career-card">
          <h2>Company and authorized recruiter</h2>
          <CareerForm
            action="register"
            fields={[
              f('companyName', 'Legal company name'),
              f('website', 'Official company website', undefined, 'url'),
              f('businessEmail', 'Business email matching website domain'),
              f('recruiterName', 'Authorized recruiter name'),
              f('industry', 'Industry'),
              f('location', 'Company location'),
              f(
                'requirements',
                'Hiring requirements and recruiter authority',
                undefined,
                'textarea',
              ),
              f(
                'confirmEmployer',
                'I am authorized to register this company using a recruiter account',
                false,
                'checkbox',
                true,
              ),
            ]}
            button="Register company"
          />
        </section>
      </CareerShell>
    );
  const d = await employerHome(a, q),
    e = d.company,
    verified = e.verificationStatus === 'VERIFIED',
    directory = verified ? await candidates(a, q) : { rows: [], page: d.page },
    documents = await getDb().careerDocument.findMany({
      where: { userId: a.id },
      select: { id: true, name: true, removedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  return (
    <CareerShell role={a.role}>
      <p className="learn-kicker">HIRING, WITH CLEAR EVIDENCE</p>
      <h1>{e.companyName}</h1>
      <Status>{e.verificationStatus}</Status>
      <p>
        {e.industry} · {e.location} · {e.recruiterName}
      </p>
      <p>
        {e.reviewNote || 'Administrative review has not yet been completed.'}
      </p>
      {['REGISTERED', 'REJECTED'].includes(e.verificationStatus) && (
        <section className="career-card">
          <h2>Submit company verification</h2>
          <CareerForm
            action="employer-review"
            values={{
              employerId: e.id,
              version: e.version,
              status: 'PENDING_REVIEW',
            }}
            fields={[
              f(
                'note',
                'Verification submission and authorization details',
                undefined,
                'textarea',
              ),
            ]}
            button="Submit for administrative review"
          />
        </section>
      )}
      <section className="career-card">
        <h2>Company profile</h2>
        <details>
          <summary>Edit company identity and hiring requirements</summary>
          <p>
            Saving changes requires renewed administrative verification and
            removes current openings from publication.
          </p>
          <CareerForm
            action="company-profile"
            values={{ version: e.version }}
            fields={[
              f('companyName', 'Updated legal company name', e.companyName),
              f('website', 'Updated company website', e.website ?? '', 'url'),
              f('businessEmail', 'Updated business email', e.businessEmail),
              f(
                'recruiterName',
                'Updated authorized recruiter',
                e.recruiterName,
              ),
              f('industry', 'Updated company industry', e.industry),
              f('location', 'Updated company location', e.location),
              f(
                'requirements',
                'Updated hiring requirements and authority',
                e.requirements,
                'textarea',
              ),
            ]}
            button="Save company profile for review"
          />
        </details>
      </section>
      <section className="career-card">
        <h2>Private verification documents</h2>
        <CompanyUpload />
        {documents.map((d) => (
          <article key={d.id}>
            <p>
              {d.removedAt ? (
                'Retired'
              ) : (
                <a href={`/api/career/document?id=${d.id}`}>{d.name}</a>
              )}
            </p>
            {!d.removedAt && (
              <details>
                <summary>Retire {d.name}</summary>
                <CareerForm
                  action="retire"
                  values={{ id: d.id, kind: 'DOCUMENT' }}
                  fields={[
                    f(
                      'reason',
                      'Document retirement reason',
                      undefined,
                      'textarea',
                    ),
                  ]}
                  button="Retire company document"
                />
              </details>
            )}
          </article>
        ))}
      </section>
      {!verified ? (
        <div className="career-notice">
          Candidate discovery and job publication remain locked until
          administrative verification is complete.
        </div>
      ) : (
        <>
          <div className="career-stats">
            {d.analytics.map((x) => (
              <div className="career-stat" key={x.status}>
                <strong>{x._count}</strong>
                <span>{x.status.replaceAll('_', ' ')}</span>
              </div>
            ))}
          </div>
          <div className="career-grid">
            <section className="career-card">
              <h2>Your openings</h2>
              <p>
                Draft → admin moderation → publication. ARCHIVED closes an
                opening; deadlines automatically stop discovery and
                applications. Editing approved content requires renewed
                moderation.
              </p>
              {d.jobs.map((j) => (
                <article key={j.id}>
                  <h3>{j.title}</h3>
                  <Status>
                    {j.status} · {j.moderation}
                  </Status>
                  <p>{j.moderationNote}</p>
                  <details>
                    <summary>Edit {j.title}</summary>
                    <JobForm job={j} />
                  </details>
                </article>
              ))}
              <details>
                <summary>Create an opening</summary>
                <JobForm />
              </details>
            </section>
            <section className="career-card">
              <h2>Application pipeline</h2>
              {d.applications.length ? (
                d.applications.map((p) => (
                  <p key={p.id}>
                    <Link href={`/career/applications/${p.id}`}>
                      {p.opportunity.title} · {p.status}
                    </Link>
                  </p>
                ))
              ) : (
                <p>No submitted applications yet.</p>
              )}
              <p>
                Candidate information is fetched only when current consent
                permits access.
              </p>
            </section>
          </div>
          <section className="career-card">
            <h2>Discover consenting candidates</h2>
            <p>
              Profiles require paid eligibility, staff-reviewed readiness and
              explicit directory or company sharing. Skills and professional
              experience are self-reported; approved training portfolios are
              labelled separately.
            </p>
            <form className="career-filter">
              <label>
                Exact skill filter
                <input name="q" defaultValue={q.q} maxLength={100} />
              </label>
              <label>
                Minimum self-reported years
                <input
                  name="experience"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={q.experience}
                />
              </label>
              <button className="button button-secondary">
                Filter candidates
              </button>
            </form>
            <div className="career-grid">
              {directory.rows.map((p) => (
                <article className="career-card" key={p.userId}>
                  <h3>
                    <Link href={`/career/candidates/${p.userId}`}>
                      {p.displayName}
                    </Link>
                  </h3>
                  <p>{p.headline}</p>
                  <p>{p.skills.join(' · ')}</p>
                </article>
              ))}
            </div>
            {!directory.rows.length && (
              <p>No authorized candidates match this filter.</p>
            )}
          </section>
          <Pager
            page={d.page}
            base="/career/employer"
            extra={`&q=${encodeURIComponent(q.q ?? '')}&experience=${encodeURIComponent(q.experience ?? '')}`}
          />
        </>
      )}
    </CareerShell>
  );
}
