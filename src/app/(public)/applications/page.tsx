import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { applicantPage } from '@/lib/admissions/page-auth';
import { ownApplications } from '@/lib/admissions/service';
import '@/styles/courses.css';
export const dynamic = 'force-dynamic';
export default async function Applications() {
  const who = await applicantPage('/applications');
  const rows = await ownApplications(who.id);
  return (
    <main id="main" className="admissions-page">
      <Container>
        <p className="eyebrow">YOUR PROGRESS. YOUR NEXT STEP.</p>
        <h1>My applications.</h1>
        <p className="workflow-intro">
          Resume a draft, follow admissions review, and review the terms before
          any payment.
        </p>
        <div className="application-records">
          {rows.map((app) => (
            <article key={app.id}>
              <div>
                <span className="status-pill">
                  {app.status.replaceAll('_', ' ')}
                </span>
                <h2>{app.course?.title}</h2>
                <p>
                  Updated{' '}
                  {app.updatedAt.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                  })}
                </p>
              </div>
              <Link
                className="button button-secondary"
                href={
                  app.status === 'DRAFT'
                    ? `/apply/${app.course?.slug}`
                    : `/applications/${app.id}`
                }
              >
                {app.status === 'DRAFT' ? 'Resume draft' : 'View status'}
              </Link>
            </article>
          ))}
        </div>
        {!rows.length && (
          <div className="catalog-empty">
            <h2>A new direction starts here.</h2>
            <p>You haven’t saved an application yet.</p>
            <Link className="button button-primary" href="/programs">
              Explore Programs
            </Link>
          </div>
        )}
      </Container>
    </main>
  );
}
