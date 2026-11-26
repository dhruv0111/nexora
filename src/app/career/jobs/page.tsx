import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { jobs } from '@/lib/career/read';
import { CareerShell, Pager, Status } from '@/components/career/ui';
import { displayTime } from '@/lib/learning/policy';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireRole(['STUDENT', 'EMPLOYER', 'ADMIN', 'MENTOR']),
    q = await searchParams,
    d = await jobs({ id: s.user.id, role: s.user.role }, q);
  return (
    <CareerShell role={s.user.role}>
      <p className="learn-kicker">FIND YOUR NEXT CONVERSATION</p>
      <h1>Opportunities, thoughtfully matched.</h1>
      <p>
        Current openings from administratively verified employers. Each role is
        reviewed before publication.
      </p>
      <form className="career-filter">
        <label>
          Search job titles
          <input name="q" defaultValue={q.q} maxLength={100} />
        </label>
        <label>
          Work arrangement
          <select name="mode" defaultValue={q.mode ?? ''}>
            <option value="">All arrangements</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>
        </label>
        <button className="button button-secondary">Find opportunities</button>
      </form>
      <div className="career-grid">
        {d.rows.map((j) => (
          <article className="career-card" key={j.id}>
            <Status>
              {j.workMode} · {j.employmentType}
            </Status>
            <h2>
              <Link href={`/career/jobs/${j.id}`}>{j.title}</Link>
            </h2>
            <p>
              {j.employer.companyName} · {j.location}
            </p>
            <p>{j.description.slice(0, 220)}</p>
            <p>{j.skills.join(' · ')}</p>
            <p>
              {j.compensationMax
                ? `${j.currency} ${j.compensationMin?.toLocaleString()}–${j.compensationMax.toLocaleString()} annually`
                : 'Compensation not disclosed'}
            </p>
            <p>Apply by {displayTime(j.deadline!)}</p>
          </article>
        ))}
      </div>
      {!d.rows.length && (
        <section className="career-card">
          <h2>No current openings match this search</h2>
          <p>
            We show genuine moderated openings only. Adjust your filters or
            return when employers publish new roles.
          </p>
        </section>
      )}
      <Pager
        page={d.page}
        base="/career/jobs"
        extra={`&q=${encodeURIComponent(q.q ?? '')}&mode=${encodeURIComponent(q.mode ?? '')}`}
      />
    </CareerShell>
  );
}
