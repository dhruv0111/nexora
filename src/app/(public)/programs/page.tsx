import '@/styles/courses.css';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { Catalog } from '@/components/courses/catalog';
import { catalog } from '@/lib/catalog/read';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore your next direction' };
export default async function Programs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const params = await searchParams;
  const courses = await catalog();
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  const level = ['beginner', 'foundations'].includes(params.level ?? '')
    ? params.level!
    : 'all';
  return (
    <main id="main" className="courses-page">
      <Container>
        <div className="catalog-intro">
          <div>
            <p className="eyebrow">THE NEXT CHAPTER IS YOURS TO BUILD</p>
            <h1>
              Find your direction.
              <br />
              <span className="gradient-text">Build what comes next.</span>
            </h1>
            <p>
              Four focused paths into technology. Explore the skills, understand
              the starting point, and choose with clarity.
            </p>
            <div className="catalog-intro-links">
              <Link href="#compare-tracks">Compare the tracks</Link>
              <Link href="/applications">My applications</Link>
            </div>
          </div>
          <div className="catalog-editorial">
            <span className="catalog-editorial-line" />
            <span>
              CURIOUS TODAY.
              <br />
              <strong>CAPABLE TOMORROW.</strong>
            </span>
            <p>Learn. Build. Launch.</p>
          </div>
        </div>
        {courses.some((c) => !c.verified) && (
          <div className="catalog-notice">
            Planning previews are clearly labeled. The 24-week outlines and
            prerequisites are illustrative until their approved sources are
            supplied. Fees, cohort dates, and legal terms are never invented.
          </div>
        )}
        {courses.some((c) => c.offline) && (
          <div className="catalog-notice">
            The catalog database is not configured or unavailable. You can
            explore the planning previews; saving an application requires a
            configured account and database.
          </div>
        )}
        <Catalog courses={courses} q={q} level={level} />
      </Container>
    </main>
  );
}
