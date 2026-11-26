import '@/styles/learning.css';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { courseLearning } from '@/lib/learning/read';
import { learningPage } from '@/lib/learning/page-policy';
import {
  LearningShell,
  PageHeading,
  Empty,
  Progress,
} from '@/components/learning/shell';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const s = await requireRole(['STUDENT']),
    enrollmentId = (await params).enrollmentId,
    d = await learningPage(() => courseLearning(s.user.id, enrollmentId)),
    q = ((await searchParams).q ?? '').slice(0, 100).toLowerCase();
  return (
    <LearningShell role="STUDENT" active="courses">
      <nav aria-label="Breadcrumb">
        <Link href="/learning/courses">My learning</Link> /{' '}
        {d.e.cohort.course.title}
      </nav>
      <PageHeading title={d.e.cohort.course.title}>
        {d.e.cohort.name} · A clear path, one lesson at a time.
      </PageHeading>
      <section className="learn-card">
        <Progress
          value={d.summary.percent}
          label={`${d.summary.completed} of ${d.summary.total} published lessons`}
        />
        <p className="learn-meta">
          Progress counts your completed published lessons. Your records
          persist; changes to published content can change the denominator.
        </p>
        {d.next && (
          <Link
            className="button button-primary"
            href={`/learn/${d.e.id}/${d.next.id}`}
          >
            Continue learning
          </Link>
        )}
      </section>
      <section className="learn-card">
        <h2>Module milestones</h2>
        <div className="learn-grid-three">
          {[
            ...new Map(
              d.lessons
                .filter((l) => l.module)
                .map((l) => [l.moduleId, l.module!]),
            ).entries(),
          ].map(([moduleId, mod]) => {
            const lessons = d.lessons.filter((l) => l.moduleId === moduleId),
              count = lessons.filter((l) => d.completed.has(l.id)).length;
            return (
              <div key={moduleId} className="learn-note">
                <strong>{mod.title}</strong>
                <p>
                  {count} / {lessons.length} published lessons completed
                </p>
                <span className="learn-tag">
                  {count === lessons.length ? 'Module complete' : 'In progress'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <form className="learn-search">
        <label>
          Search published lessons
          <input name="q" defaultValue={q} maxLength={100} />
        </label>
        <button className="button button-secondary">Search lessons</button>
      </form>
      <section className="learn-card">
        <h2>Course navigation</h2>
        {d.lessons.length ? (
          <ol className="learn-list">
            {d.lessons
              .filter((l) => l.title.toLowerCase().includes(q))
              .map((l) => (
                <li key={l.id}>
                  <span className="learn-meta">
                    {l.module?.title ?? 'Course lesson'} · {l.kind}
                  </span>
                  <h3>{l.title}</h3>
                  {d.available(l) ? (
                    <Link href={`/learn/${d.e.id}/${l.id}`}>
                      {d.completed.has(l.id)
                        ? 'Review completed lesson'
                        : 'Open lesson'}
                    </Link>
                  ) : (
                    <span className="learn-tag">
                      Locked · Complete prerequisite
                    </span>
                  )}
                </li>
              ))}
          </ol>
        ) : (
          <Empty title="Your lessons are being prepared.">
            Only published learning content appears here.
          </Empty>
        )}
      </section>
    </LearningShell>
  );
}
