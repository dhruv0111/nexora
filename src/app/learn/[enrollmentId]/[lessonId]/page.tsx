import '@/styles/learning.css';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { lessonForStudent } from '@/lib/learning/content';
import { learningPage } from '@/lib/learning/page-policy';
import { courseLearning } from '@/lib/learning/read';
import { LearningShell, PageHeading } from '@/components/learning/shell';
import {
  LessonPlayer,
  LessonControls,
} from '@/components/learning/lesson-player';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ enrollmentId: string; lessonId: string }>;
}) {
  const s = await requireRole(['STUDENT']),
    p = await params,
    { lesson, e, progress } = await learningPage(() =>
      lessonForStudent(s.user.id, p.enrollmentId, p.lessonId),
    ),
    d = await learningPage(() => courseLearning(s.user.id, e.id));
  return (
    <LearningShell role="STUDENT" active="courses">
      <nav aria-label="Breadcrumb">
        <Link href="/learning/courses">My learning</Link> /{' '}
        <Link href={`/learn/${e.id}`}>{e.cohort.course.title}</Link> /{' '}
        {lesson.module?.title ?? 'Lesson'}
      </nav>
      <PageHeading eyebrow="FOCUS ON THE NEXT STEP" title={lesson.title}>
        {lesson.module?.title} · {lesson.kind} · Revision {lesson.version}
      </PageHeading>
      <div className="learn-lesson-layout">
        <aside className="learn-card learn-lesson-nav">
          <h2>Your course</h2>
          <nav aria-label="Lesson navigation">
            {d.lessons.map((l) =>
              d.available(l) ? (
                <Link
                  key={l.id}
                  aria-current={l.id === lesson.id ? 'page' : undefined}
                  href={`/learn/${e.id}/${l.id}`}
                >
                  {d.completed.has(l.id) ? '✓ ' : ''}
                  {l.title}
                </Link>
              ) : (
                <p key={l.id} className="learn-meta">
                  Locked · {l.title}
                </p>
              ),
            )}
          </nav>
        </aside>
        <article className="learn-card">
          {lesson.videoUrl && (
            <LessonPlayer
              url={lesson.videoUrl}
              captions={lesson.captionsUrl}
              position={progress?.positionSeconds ?? 0}
            />
          )}
          <h2>Lesson resources & notes</h2>
          <div className="learn-lesson-body">{lesson.content}</div>
          {lesson.resourceUrl && (
            <p>
              <a
                href={lesson.resourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open learning resource
              </a>
            </p>
          )}
          <LessonControls
            enrollmentId={e.id}
            lessonId={lesson.id}
            position={progress?.positionSeconds ?? 0}
            duration={lesson.durationSeconds}
            completed={!!progress?.completedAt}
          />
          {d.next && d.next.id !== lesson.id && (
            <Link href={`/learn/${e.id}/${d.next.id}`}>
              Continue to {d.next.title}
            </Link>
          )}
          <p className="learn-note">
            Completion records your acknowledgement; it is not proof of mastery.
            Assessments and mentor reviews are tracked separately.
          </p>
        </article>
      </div>
    </LearningShell>
  );
}
