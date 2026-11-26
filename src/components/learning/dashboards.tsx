import Link from 'next/link';
import { studentHome, staffCohorts, cohortOverview } from '@/lib/learning/read';
import { displayTime, progressSummary } from '@/lib/learning/policy';
import { LearningShell, PageHeading, Empty, Progress } from './shell';
import type { Actor } from '@/lib/domain/http';
export async function StudentDashboard({
  userId,
  name,
}: {
  userId: string;
  name: string | null | undefined;
}) {
  const d = await studentHome(userId),
    completed = d.enrollments.reduce(
      (sum, e) =>
        sum +
        e.lessonProgress.filter(
          (p) =>
            p.completedAt &&
            e.cohort.course.lessons.some((l) => l.id === p.lessonId),
        ).length,
      0,
    );
  return (
    <LearningShell role="STUDENT">
      <PageHeading
        title={`Welcome${name ? `, ${name.split(' ')[0]}` : ''}. Make today count.`}
      >
        Your learning, your pace. Pick up where you left off.
      </PageHeading>
      <div className="learn-grid-three">
        <div className="learn-stat">
          <strong>{d.enrollments.length}</strong>
          <span>Accessible enrollments</span>
        </div>
        <div className="learn-stat">
          <strong>{completed}</strong>
          <span>Published lessons completed</span>
        </div>
        <div className="learn-stat">
          <strong>{d.tasks.length === 5 ? '5+' : d.tasks.length}</strong>
          <span>Upcoming tasks in this view</span>
        </div>
      </div>
      <div className="learn-grid">
        <section className="learn-card learn-feature-card">
          <p className="learn-kicker">KEEP YOUR MOMENTUM</p>
          <h2>Your learning journey</h2>
          {d.enrollments.length ? (
            <ul className="learn-list">
              {d.enrollments.map((e) => {
                const lessons = e.cohort.course.lessons,
                  done = new Set(
                    e.lessonProgress
                      .filter((p) => p.completedAt)
                      .map((p) => p.lessonId),
                  ),
                  s = progressSummary(lessons, done),
                  next = lessons.find(
                    (l) =>
                      !done.has(l.id) &&
                      (!l.prerequisiteId ||
                        (done.has(l.prerequisiteId) &&
                          lessons.some((p) => p.id === l.prerequisiteId))),
                  );
                return (
                  <li key={e.id}>
                    <span className="learn-tag">{e.cohort.name}</span>
                    <h3>{e.cohort.course.title}</h3>
                    <Progress
                      value={s.percent}
                      label={`${s.completed} of ${s.total} lessons`}
                    />
                    <Link
                      className="button button-primary"
                      href={
                        next ? `/learn/${e.id}/${next.id}` : `/learn/${e.id}`
                      }
                    >
                      {next
                        ? 'Continue learning'
                        : s.total
                          ? 'Review learning'
                          : 'View course'}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="Your next chapter is waiting.">
              Approved, verified paid enrollments appear here.{' '}
              <Link href="/applications">Check your application</Link> or{' '}
              <Link href="/programs">explore programs</Link>.
            </Empty>
          )}
        </section>
        <section className="learn-card">
          <p className="learn-kicker">MAKE SPACE TO LEARN</p>
          <h2>Your next live classes</h2>
          {d.classes.length ? (
            <ul className="learn-list">
              {d.classes.map((c) => (
                <li key={c.id}>
                  <span className="learn-tag">{c.status}</span>
                  <h3>{c.title}</h3>
                  <time dateTime={c.startsAt.toISOString()}>
                    {displayTime(c.startsAt)} IST
                  </time>
                  <p>{c.description}</p>
                  <Link href="/learning/classes">View class details</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No upcoming classes scheduled.">
              Published sessions for your cohorts will appear here.
            </Empty>
          )}
          <Link href="/learning/classes">Open your calendar</Link>
        </section>
      </div>
      {d.enrollments.map((e) => {
        const week = e.cohort.startsAt
          ? Math.max(
              1,
              Math.min(
                24,
                Math.floor(
                  (d.now - e.cohort.startsAt.getTime()) / (7 * 86400000),
                ) + 1,
              ),
            )
          : null;
        return (
          <section className="learn-card" key={e.id}>
            <h2>{e.cohort.course.title} · Weekly roadmap</h2>
            <p className="learn-meta">
              {e.cohort.startsAt && e.cohort.startsAt > new Date()
                ? 'Cohort has not started.'
                : week
                  ? `Current scheduled week: ${week}`
                  : 'Start date not configured.'}{' '}
              Roadmap is based on the published course outline.
            </p>
            <ol className="learn-roadmap">
              {e.cohort.course.modules.map((m) => (
                <li key={m.id}>
                  <small>
                    WEEKS {m.startWeek}–{m.startWeek + 3}
                  </small>
                  {m.title}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <div className="learn-grid">
        <section className="learn-card">
          <h2>Next on your list</h2>
          {d.tasks.length ? (
            <ul className="learn-list">
              {d.tasks.map((t) => (
                <li key={t.id}>
                  <h3>{t.title}</h3>
                  <small>
                    {t.dueAt
                      ? `Due ${displayTime(t.dueAt)} IST`
                      : 'No deadline'}
                  </small>
                  <Link href="/learning/assignments">Open assignment</Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No pending assignments due.">
              Your published tasks will appear here.
            </Empty>
          )}
        </section>
        <section className="learn-card">
          <h2>Feedback that moves you forward</h2>
          {d.feedback.length ? (
            <ul className="learn-list">
              {d.feedback.map((f) => (
                <li key={f.id}>
                  <h3>{f.assignment.title}</h3>
                  <p>{f.feedback}</p>
                  <Link href="/learning/assignments">
                    Review grade & rubric
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Your feedback belongs here.">
              Mentor reviews appear after grading.
            </Empty>
          )}
        </section>
        <section className="learn-card">
          <h2>Assessments & learning milestones</h2>
          {d.quizzes.length ? (
            <ul className="learn-list">
              {d.quizzes.map((q) => (
                <li key={q.id}>
                  <h3>{q.assessment.title}</h3>
                  <span className="learn-tag">
                    {q.passed ? 'Passed' : 'Practice needed'}
                  </span>
                  <span>
                    {q.score} / {q.assessment.maxScore}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Build understanding, step by step.">
              No assessment results yet.
            </Empty>
          )}
          <p className="learn-note">
            Career readiness assessments are not available yet. Lesson progress
            tracks your learning activity.
          </p>
        </section>
        <section className="learn-card">
          <h2>Your project participation</h2>
          {d.pods.length ? (
            <ul>
              {d.pods.map((p) => (
                <li key={p.podId}>{p.pod.name}</li>
              ))}
            </ul>
          ) : (
            <Empty title="No project pod assigned.">
              Your mentor will share project participation details when a pod is
              assigned.
            </Empty>
          )}
        </section>
        <section className="learn-card">
          <h2>Cohort announcements</h2>
          {d.announcements.length ? (
            <ul className="learn-list">
              {d.announcements.map((a) => (
                <li key={a.id}>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="You’re up to date.">
              No cohort announcements yet.
            </Empty>
          )}
        </section>
        <section className="learn-card">
          <h2>Notifications</h2>
          {d.notifications.length ? (
            <ul className="learn-list">
              {d.notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.href}>{n.title}</Link>
                  <small>
                    {displayTime(n.createdAt)} IST ·{' '}
                    {n.readAt ? 'Read' : 'Unread'}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="A quiet moment to focus.">
              Class changes, feedback, and support replies appear here.
            </Empty>
          )}
          <Link href="/learning/support">
            Get learning or technical support
          </Link>
        </section>
      </div>
    </LearningShell>
  );
}
export async function StaffDashboard({ actor }: { actor: Actor }) {
  const cohorts = await staffCohorts(actor);
  return (
    <LearningShell role={actor.role}>
      <PageHeading
        eyebrow="THOUGHTFUL GUIDANCE. REAL PROGRESS."
        title={
          actor.role === 'MENTOR'
            ? 'Make space for great potential.'
            : 'Learning operations'
        }
      >
        Your assigned cohorts, learning activity, and conversations in one
        focused workspace.
      </PageHeading>
      <div className="learn-grid-three">
        <div className="learn-stat">
          <strong>{cohorts.length}</strong>
          <span>Cohorts in this view</span>
        </div>
        <div className="learn-stat">
          <strong>
            {cohorts.reduce((n, c) => n + c._count.enrollments, 0)}
          </strong>
          <span>Verified active enrollments</span>
        </div>
        <div className="learn-stat">
          <strong>IST</strong>
          <span>Schedule display timezone</span>
        </div>
      </div>
      <section className="learn-card">
        <h2>
          {actor.role === 'MENTOR'
            ? 'Your assigned cohorts'
            : 'Manage learning'}
        </h2>
        {cohorts.length ? (
          <ul className="learn-list">
            {cohorts.map((c) => (
              <li key={c.id}>
                <span className="learn-tag">{c.status}</span>
                <h3>{c.course.title}</h3>
                <p>
                  {c.name} · {c._count.enrollments} verified active enrollments
                </p>
                <Link href={`/learning/cohorts?cohort=${c.id}`}>
                  Open cohort workspace
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No cohorts assigned yet.">
            An administrator must assign your mentor profile before student data
            becomes available.
          </Empty>
        )}
      </section>
      {actor.role === 'ADMIN' && (
        <section className="learn-card">
          <h2>Administration</h2>
          <div className="learn-link-row">
            <Link href="/learning/content">Publish lessons</Link>
            <Link href="/learning/instructors">Assign instructors</Link>
            <Link href="/learning/support">Student support</Link>
            <Link href="/dashboard/admin/admissions?view=enrollments">
              Enrollment access & payment status
            </Link>
          </div>
        </section>
      )}
    </LearningShell>
  );
}
export async function CohortRoster({
  actor,
  cohortId,
  page,
}: {
  actor: Actor;
  cohortId: string;
  page: number;
}) {
  const d = await cohortOverview(actor, cohortId, page);
  return (
    <>
      <section className="learn-card">
        <h2>{d.c.name} · Student progress</h2>
        <p className="learn-meta">
          Risk rules: any overdue unsubmitted task, or no completed-lesson
          activity for 7 days after cohort start. These indicate support needs,
          not ability or employability.
        </p>
        {d.students.length ? (
          <div
            className="learn-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Student progress table"
          >
            <table className="learn-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Learning</th>
                  <th>Assignments</th>
                  <th>Attendance</th>
                  <th>Assessment passes</th>
                  <th>Support indicators</th>
                </tr>
              </thead>
              <tbody>
                {d.students.map((e) => {
                  const done = new Set(
                      e.lessonProgress
                        .filter((p) => p.completedAt)
                        .map((p) => p.lessonId),
                    ),
                    p = progressSummary(d.lessons, done),
                    missing = d.assignments.filter(
                      (a) =>
                        a.dueAt &&
                        a.dueAt < new Date() &&
                        !d.submissions.some(
                          (s) =>
                            s.userId === e.userId &&
                            s.assignmentId === a.id &&
                            s.state !== 'DRAFT',
                        ),
                    ).length,
                    latest = e.lessonProgress
                      .filter((p) => p.completedAt)
                      .map((p) => p.completedAt!)
                      .sort((a, b) => b.getTime() - a.getTime())[0],
                    quiet =
                      d.c.startsAt &&
                      d.c.startsAt.getTime() < d.now - 7 * 86400000 &&
                      (!latest || latest.getTime() < d.now - 7 * 86400000);
                  return (
                    <tr key={e.id}>
                      <td>
                        {e.user.name ?? 'Student'}
                        <small className="learn-meta">{e.userId}</small>
                      </td>
                      <td>
                        {p.completed}/{p.total} · {p.percent}%
                      </td>
                      <td>
                        {
                          d.submissions.filter(
                            (s) => s.userId === e.userId && s.state !== 'DRAFT',
                          ).length
                        }{' '}
                        submitted
                      </td>
                      <td>
                        {
                          d.attendance.filter(
                            (a) =>
                              a.userId === e.userId && a.status === 'PRESENT',
                          ).length
                        }{' '}
                        present
                      </td>
                      <td>
                        {
                          d.results.filter(
                            (q) => q.userId === e.userId && q.passed,
                          ).length
                        }
                      </td>
                      <td>
                        {missing ? `${missing} overdue task(s). ` : ''}
                        {quiet
                          ? 'No recent completion.'
                          : !missing
                            ? 'No flags from these rules.'
                            : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No verified active learners on this page." />
        )}
        <div className="learn-pagination">
          {page > 1 && (
            <Link href={`?cohort=${cohortId}&page=${page - 1}`}>
              Previous students
            </Link>
          )}
          {d.students.length === 20 && (
            <Link href={`?cohort=${cohortId}&page=${page + 1}`}>
              Next students
            </Link>
          )}
        </div>
      </section>
      <section className="learn-card">
        <h2>Classes & attendance</h2>
        {d.classes.length ? (
          <ul className="learn-list">
            {d.classes.map((c) => (
              <li key={c.id}>
                <h3>{c.title}</h3>
                <span>
                  {displayTime(c.startsAt)} IST · {c.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No classes scheduled." />
        )}
      </section>
    </>
  );
}
