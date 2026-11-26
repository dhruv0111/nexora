import Link from 'next/link';
import { getDb } from '@/lib/db';
import { studentCohorts, studentHome } from '@/lib/learning/read';
import { displayTime, pageNumber } from '@/lib/learning/policy';
import { ActionForm, UploadForm } from './action-form';
import { Empty } from './shell';
import { QuizForm } from './quiz-form';
import { questionsSchema, rubricSchema } from '@/lib/learning/tasks';
export async function StudentSection({
  userId,
  section,
  query,
}: {
  userId: string;
  section: string;
  query: Record<string, string | undefined>;
}) {
  const db = getDb(),
    enrollments = await studentCohorts(userId),
    cohortIds = enrollments.map((e) => e.cohortId),
    page = pageNumber(query.page),
    skip = (page - 1) * 20;
  if (section === 'courses') {
    const d = await studentHome(userId);
    return (
      <section className="learn-card">
        <h2>Your enrolled courses</h2>
        {d.enrollments.length ? (
          <ul className="learn-list">
            {d.enrollments.map((e) => (
              <li key={e.id}>
                <h3>{e.cohort.course.title}</h3>
                <p>{e.cohort.name}</p>
                <Link href={`/learn/${e.id}`}>Open learning roadmap</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No accessible enrollments yet.">
            Pending, unpaid, refunded, or review-required enrollments do not
            unlock learning.
          </Empty>
        )}
      </section>
    );
  }
  if (section === 'classes') {
    const classes = await db.liveClass.findMany({
      where: { cohortId: { in: cohortIds } },
      include: { attendance: { where: { userId }, take: 1 } },
      orderBy: { startsAt: 'desc' },
      skip,
      take: 20,
    });
    return (
      <>
        <section className="learn-card">
          <h2>Your class calendar</h2>
          <p className="learn-meta">
            All times are shown in Asia/Kolkata (IST). Meeting and recording
            links appear only when staff supply them. No conferencing account or
            email service is connected.
          </p>
          {classes.length ? (
            <ul className="learn-list">
              {classes.map((c) => (
                <li key={c.id}>
                  <span className="learn-tag">{c.status}</span>
                  <h3>{c.title}</h3>
                  <time dateTime={c.startsAt.toISOString()}>
                    {displayTime(c.startsAt)} – {displayTime(c.endsAt)} IST
                  </time>
                  <p>{c.description}</p>
                  {c.status !== 'CANCELLED' && (
                    <div className="learn-link-row">
                      {c.meetingUrl ? (
                        <a
                          href={c.meetingUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open meeting
                        </a>
                      ) : (
                        <span className="learn-meta">
                          Meeting link not provided
                        </span>
                      )}
                      {c.recordingUrl && (
                        <a
                          href={c.recordingUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open recording
                        </a>
                      )}
                    </div>
                  )}
                  <span className="learn-meta">
                    Attendance: {c.attendance[0]?.status ?? 'Not recorded'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No sessions scheduled.">
              Class schedules and changes appear here and in your dashboard
              notifications.
            </Empty>
          )}
        </section>
        <Pagination page={page} hasNext={classes.length === 20} />
      </>
    );
  }
  if (section === 'assignments') {
    const tasks = await db.assignment.findMany({
      where: { cohortId: { in: cohortIds }, status: 'PUBLISHED' },
      include: {
        submissions: {
          where: { userId },
          take: 1,
          include: {
            attachments: { select: { id: true, name: true, size: true } },
            revisions: {
              orderBy: { version: 'desc' },
              take: 5,
              select: { version: true, snapshot: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      skip,
      take: 20,
    });
    return (
      <>
        {!tasks.length && <Empty title="No published assignments yet." />}
        {tasks.map((a) => {
          const e = enrollments.find((e) => e.cohortId === a.cohortId)!,
            s = a.submissions[0],
            rubric = rubricSchema.safeParse(a.rubric),
            canEdit =
              (!s ||
                s.state === 'DRAFT' ||
                (s.state === 'GRADED' && a.allowResubmit)) &&
              !!a.dueAt &&
              a.dueAt > new Date();
          return (
            <section className="learn-card" key={a.id}>
              <span className="learn-tag">{s?.state ?? 'Not started'}</span>
              <h2>{a.title}</h2>
              <p className="learn-meta">
                {e.cohort.name} · Due{' '}
                {a.dueAt ? displayTime(a.dueAt) + ' IST' : 'date not set'} ·{' '}
                {a.allowResubmit
                  ? 'Resubmission permitted after grading, before deadline'
                  : 'One submission; no resubmission'}
              </p>
              <div className="learn-lesson-body">{a.instructions}</div>
              {a.resourceUrl && (
                <a
                  href={a.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Assignment resource
                </a>
              )}
              <h3>Grading rubric</h3>
              {rubric.success ? (
                <ul>
                  {rubric.data.map((r, i) => (
                    <li key={i}>
                      {r.criterion} · {r.points} points
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Rubric unavailable. Contact your mentor.</p>
              )}
              {s?.state === 'GRADED' && (
                <div className="learn-note">
                  <h3>Mentor feedback</h3>
                  <p>{s.feedback}</p>
                  <strong>
                    Grade: {s.score} /{' '}
                    {rubric.success
                      ? rubric.data.reduce((n, r) => n + r.points, 0)
                      : '—'}
                  </strong>
                  <p className="learn-meta">
                    {s.gradedAt ? displayTime(s.gradedAt) + ' IST' : ''}
                  </p>
                </div>
              )}
              {s?.attachments.map((f) => (
                <p key={f.id}>
                  <a href={`/api/learning/files/${f.id}`}>Download {f.name}</a>{' '}
                  · {Math.ceil(f.size / 1024)} KB
                </p>
              ))}
              {canEdit ? (
                <>
                  <ActionForm
                    key={`${a.id}:${s?.version}`}
                    action="submission"
                    values={{
                      assignmentId: a.id,
                      enrollmentId: e.id,
                      version: s?.version ?? 0,
                    }}
                    fields={[
                      {
                        name: 'body',
                        label: 'Your work or explanation',
                        type: 'textarea',
                        value: s?.body ?? '',
                      },
                      {
                        name: 'repositoryUrl',
                        label: 'HTTPS repository or evidence link',
                        type: 'url',
                        value: s?.repositoryUrl ?? '',
                      },
                      {
                        name: 'action',
                        label: 'Submission action',
                        type: 'select',
                        value: 'save',
                        options: [
                          { value: 'save', label: 'Save draft' },
                          { value: 'submit', label: 'Submit for review' },
                        ],
                      },
                    ]}
                    button="Save assignment"
                    success="Assignment saved."
                  />
                  {s?.state === 'DRAFT' ? (
                    <UploadForm submissionId={s.id} enrollmentId={e.id} />
                  ) : (
                    <p className="learn-meta">Save a draft to attach files.</p>
                  )}
                </>
              ) : (
                <p className="learn-meta">
                  {s?.body}
                  {!s
                    ? 'The submission deadline has passed. Contact your mentor.'
                    : ''}
                </p>
              )}
              {s?.revisions.some(
                (r) => (r.snapshot as { state?: string }).state === 'GRADED',
              ) && (
                <details>
                  <summary>Earlier feedback</summary>
                  {s.revisions
                    .filter(
                      (r) =>
                        (r.snapshot as { state?: string }).state === 'GRADED',
                    )
                    .map((r) => (
                      <div className="learn-message" key={r.version}>
                        <p>
                          Revision {r.version}:{' '}
                          {String(
                            (r.snapshot as { feedback?: string }).feedback ??
                              '',
                          )}
                        </p>
                      </div>
                    ))}
                </details>
              )}
            </section>
          );
        })}
        <Pagination page={page} hasNext={tasks.length === 20} />
      </>
    );
  }
  if (section === 'assessments') {
    const quizzes = await db.assessment.findMany({
      where: { cohortId: { in: cohortIds }, status: 'PUBLISHED' },
      include: {
        attempts: {
          where: { userId },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { dueAt: 'asc' },
      skip,
      take: 20,
    });
    return (
      <>
        {!quizzes.length && <Empty title="No published assessments yet." />}
        {quizzes.map((q) => {
          const questions = questionsSchema.safeParse(q.questions),
            e = enrollments.find((e) => e.cohortId === q.cohortId)!,
            remaining = q.maxAttempts - q.attempts.length;
          return (
            <section className="learn-card" key={q.id}>
              <h2>{q.title}</h2>
              <p>
                Pass threshold {q.passPercent}% · {Math.max(0, remaining)}{' '}
                attempts remaining
              </p>
              <p className="learn-meta">
                Deadline: {q.dueAt ? displayTime(q.dueAt) + ' IST' : 'Not set'}
              </p>
              {q.attempts.map((a) => (
                <p key={a.id}>
                  <span className="learn-tag">
                    {a.passed ? 'Passed' : 'Not passed'}
                  </span>
                  {a.score} / {q.maxScore} ·{' '}
                  {a.submittedAt
                    ? displayTime(a.submittedAt)
                    : 'Attempt pending'}
                </p>
              ))}
              {remaining > 0 &&
              q.dueAt &&
              q.dueAt > new Date() &&
              questions.success ? (
                <QuizForm
                  enrollmentId={e.id}
                  assessmentId={q.id}
                  version={q.version}
                  questions={questions.data.map(({ prompt, options }) => ({
                    prompt,
                    options,
                  }))}
                />
              ) : (
                <p className="learn-meta">No attempt is currently available.</p>
              )}
            </section>
          );
        })}
        <Pagination page={page} hasNext={quizzes.length === 20} />
      </>
    );
  }
  if (section === 'announcements') {
    const [notes, notifications] = await Promise.all([
      db.announcement.findMany({
        where: { cohortId: { in: cohortIds } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: 20,
      }),
      db.learningNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: 20,
      }),
    ]);
    return (
      <div className="learn-grid">
        <section className="learn-card">
          <h2>Cohort announcements</h2>
          {notes.length ? (
            notes.map((n) => (
              <article key={n.id}>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small className="learn-meta">
                  {displayTime(n.createdAt)} IST
                </small>
              </article>
            ))
          ) : (
            <Empty title="No announcements yet." />
          )}
        </section>
        <section className="learn-card">
          <h2>Your notifications</h2>
          {notifications.length ? (
            notifications.map((n) => (
              <article key={n.id}>
                <p>
                  <Link href={n.href}>{n.title}</Link>
                </p>
                <small className="learn-meta">
                  {displayTime(n.createdAt)} IST
                </small>
                {!n.readAt ? (
                  <ActionForm
                    action="notification"
                    values={{ id: n.id }}
                    fields={[]}
                    button="Mark as read"
                  />
                ) : (
                  <span className="learn-tag">Read</span>
                )}
              </article>
            ))
          ) : (
            <Empty title="You’re up to date." />
          )}
          <Pagination page={page} hasNext={notifications.length === 20} />
        </section>
      </div>
    );
  }
  const history = await db.auditLog.findMany({
    where: {
      actorId: userId,
      action: {
        in: [
          'LESSON_COMPLETED',
          'ASSIGNMENT_SUBMITTED',
          'ASSESSMENT_ATTEMPTED',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: 20,
  });
  return (
    <section className="learn-card">
      <h2>Learning activity history</h2>
      {history.length ? (
        <ul className="learn-list">
          {history.map((h) => (
            <li key={h.id}>
              {h.action.replaceAll('_', ' ')}
              <small>
                {displayTime(h.createdAt)} IST · Record {h.entityId}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="Your learning history starts here." />
      )}
      <Pagination page={page} hasNext={history.length === 20} />
    </section>
  );
}
export function Pagination({
  page,
  hasNext,
  base = '',
}: {
  page: number;
  hasNext: boolean;
  base?: string;
}) {
  return (
    <nav className="learn-pagination" aria-label="Pagination">
      {page > 1 && <Link href={`?${base}page=${page - 1}`}>Previous page</Link>}
      {hasNext && <Link href={`?${base}page=${page + 1}`}>Next page</Link>}
    </nav>
  );
}
