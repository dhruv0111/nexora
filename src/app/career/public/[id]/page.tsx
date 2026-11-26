import { notFound } from 'next/navigation';
import { publicProfile } from '@/lib/career/profile';
import { DomainError } from '@/lib/domain/errors';
import { Brand } from '@/components/layout/brand';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let p;
  try {
    p = await publicProfile((await params).id);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main id="main" className="career-content">
      <Brand />
      <p className="learn-kicker">PUBLIC TRAINING PORTFOLIO</p>
      <h1>{p.displayName}</h1>
      <p>{p.headline}</p>
      <p>Self-reported skills: {p.skills.join(' · ')}</p>
      <div className="career-notice">
        These are mentor-approved educational project summaries. They do not
        establish employment, an internship, or guaranteed placement.
      </div>
      <div className="career-grid">
        {p.portfolio.map((e, i) => (
          <article className="career-card" key={i}>
            <h2>{e.project}</h2>
            <p>{e.description}</p>
            <p>{e.technologies.join(' · ')}</p>
            <p>{e.outcome}</p>
          </article>
        ))}
      </div>
      {!p.portfolio.length && (
        <p>No publication-approved portfolio entries are available.</p>
      )}
    </main>
  );
}
