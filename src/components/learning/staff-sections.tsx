import Link from 'next/link';
import { getDb } from '@/lib/db';
import { staffCohorts } from '@/lib/learning/read';
import { cohortAccess, displayTime, pageNumber } from '@/lib/learning/policy';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { ActionForm, type Field } from './action-form';
import { CohortRoster } from './dashboards';
import { Empty } from './shell';
import { Pagination } from './student-sections';
import { rubricSchema } from '@/lib/learning/tasks';
const text = (
  name: string,
  label: string,
  value = '',
  type: Field['type'] = 'text',
): Field => ({ name, label, value, type, required: true });
const options = (
  name: string,
  label: string,
  items: { id: string; title?: string; name?: string }[],
  value = '',
): Field => ({
  name,
  label,
  type: 'select',
  value,
  options: items.map((c) => ({
    value: c.id,
    label: c.title ?? c.name ?? c.id,
  })),
  required: true,
});
const state = (value = 'DRAFT'): Field => ({
  name: 'status',
  label: 'Publication status',
  type: 'select',
  value,
  options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((value) => ({
    value,
    label: value,
  })),
});
const asLocal = (date: Date | null | undefined) =>
  date ? new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16) : '';
export async function StaffSection({
  actor,
  section,
  query,
}: {
  actor: Actor;
  section: string;
  query: Record<string, string | undefined>;
}) {
  const db = getDb(),
    page = pageNumber(query.page),
    skip = (page - 1) * 20;
  if (section === 'instructors') {
    ensure(
      actor.role === 'ADMIN',
      403,
      'ADMIN',
      'Administrator access required.',
    );
    const [cohorts, mentors] = await Promise.all([
      staffCohorts(actor),
      db.mentor.findMany({
        where: { user: { role: 'MENTOR' } },
        include: { user: { select: { name: true } } },
        take: 100,
      }),
    ]);
    return (
      <section className="learn-card">
        <h2>Assign an existing mentor profile</h2>
        <p>
          Only existing mentor-role profiles may access their assigned cohorts.
        </p>
        {cohorts.length && mentors.length ? (
          <ActionForm
            action="assign-mentor"
            fields={[
              options('cohortId', 'Cohort', cohorts),
              options(
                'mentorId',
                'Mentor',
                mentors.map((m) => ({ id: m.id, title: m.user.name ?? m.id })),
              ),
              {
                name: 'remove',
                label: 'Remove this assignment',
                type: 'checkbox',
              },
            ]}
            button="Update mentor assignment"
          />
        ) : (
          <Empty title="Create real cohorts and mentor profiles first." />
        )}
      </section>
    );
  }
  if (section === 'content') {
    ensure(
      actor.role === 'ADMIN',
      403,
      'ADMIN',
      'Administrator access required.',
    );
    const courses = await db.course.findMany({
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
        take: 40,
      }),
      courseId = query.course ?? courses[0]?.id;
    const [modules, lessons] = await Promise.all([
      db.curriculumModule.findMany({
        where: { courseId: courseId ?? '' },
        orderBy: { startWeek: 'asc' },
        take: 6,
      }),
      db.lesson.findMany({
        where: { courseId: courseId ?? '' },
        orderBy: { position: 'asc' },
        take: 500,
      }),
    ]);
    const lesson = query.lesson
      ? lessons.find((l) => l.id === query.lesson)
      : null;
    return (
      <>
        <form className="learn-search">
          <label>
            Course
            <select name="course" defaultValue={courseId}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-secondary">Select course</button>
        </form>
        <div className="learn-grid">
          <section className="learn-card">
            <h2>Lessons & ordering</h2>
            <Link href={`?course=${courseId}`}>Create lesson</Link>
            <ul className="learn-list">
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`?course=${courseId}&lesson=${l.id}`}>
                    {l.position}. {l.title}
                  </Link>
                  <span className="learn-tag">
                    {l.status} · v{l.version}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="learn-card">
            <h2>{lesson ? 'Edit lesson' : 'Create a learning lesson'}</h2>
            <p className="learn-meta">
              Course/module outlines are managed in the existing course editor.
              Only approved published courses can publish lessons. Notes are
              plain text; external URLs require HTTPS.
            </p>
            {modules.length ? (
              <ActionForm
                key={lesson?.id ?? courseId}
                action="lesson"
                values={{
                  ...(lesson ? { id: lesson.id } : {}),
                  courseId,
                  version: lesson?.version ?? 0,
                }}
                fields={[
                  text('title', 'Lesson title', lesson?.title),
                  options(
                    'moduleId',
                    'Course module',
                    modules,
                    lesson?.moduleId ?? modules[0].id,
                  ),
                  {
                    name: 'position',
                    label: 'Course ordering position',
                    type: 'number',
                    value:
                      lesson?.position ?? (lessons.at(-1)?.position ?? 0) + 1,
                    min: 1,
                    required: true,
                  },
                  {
                    name: 'kind',
                    label: 'Lesson type',
                    type: 'select',
                    value: lesson?.kind ?? 'RESOURCE',
                    options: [
                      { value: 'RESOURCE', label: 'Resource / reading' },
                      { value: 'VIDEO', label: 'Video lesson' },
                    ],
                  },
                  text(
                    'content',
                    'Lesson notes / transcript',
                    lesson?.content ?? '',
                    'textarea',
                  ),
                  {
                    ...text(
                      'videoUrl',
                      'Actual video URL',
                      lesson?.videoUrl ?? '',
                      'url',
                    ),
                    required: false,
                  },
                  {
                    ...text(
                      'captionsUrl',
                      'HTTPS WebVTT captions URL',
                      lesson?.captionsUrl ?? '',
                      'url',
                    ),
                    required: false,
                  },
                  {
                    ...text(
                      'resourceUrl',
                      'Learning resource URL',
                      lesson?.resourceUrl ?? '',
                      'url',
                    ),
                    required: false,
                  },
                  {
                    name: 'durationSeconds',
                    label: 'Video duration in seconds (0 for reading)',
                    type: 'number',
                    value: lesson?.durationSeconds ?? 0,
                    min: 0,
                    max: 86400,
                    required: true,
                  },
                  {
                    name: 'prerequisiteId',
                    label: 'Prerequisite lesson',
                    type: 'select',
                    value: lesson?.prerequisiteId ?? '',
                    options: [
                      { value: '', label: 'No prerequisite' },
                      ...lessons
                        .filter((l) => l.id !== lesson?.id)
                        .map((l) => ({ value: l.id, label: l.title })),
                    ],
                  },
                  state(lesson?.status),
                ]}
                button="Save lesson revision"
              />
            ) : (
              <Empty title="Add course modules in the course editor first." />
            )}
          </section>
        </div>
      </>
    );
  }
  const cohorts = await staffCohorts(actor),
    cohortId = query.cohort ?? cohorts[0]?.id;
  if (!cohortId)
    return (
      <Empty title="No assigned cohorts.">
        Student data is only visible after a mentor-to-cohort assignment.
      </Empty>
    );
  await cohortAccess(actor, cohortId);
  const filter = (
    <form className="learn-search">
      <label>
        Cohort
        <select name="cohort" defaultValue={cohortId}>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.course.title}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-secondary">Open cohort</button>
    </form>
  );
  const nav = (
    <nav className="learn-link-row" aria-label="Cohort tools">
      {[
        ['cohorts', 'Student progress'],
        ['classes', 'Classes & attendance'],
        ['assignments', 'Assignments & grading'],
        ['assessments', 'Assessments'],
        ['announcements', 'Announcements'],
      ].map(([key, label]) => (
        <Link key={key} href={`/learning/${key}?cohort=${cohortId}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
  if (section === 'cohorts')
    return (
      <>
        {filter}
        {nav}
        <CohortRoster actor={actor} cohortId={cohortId} page={page} />
      </>
    );
  if (section === 'classes') {
    const [classes, students] = await Promise.all([
      db.liveClass.findMany({
        where: { cohortId },
        orderBy: { startsAt: 'desc' },
        skip,
        take: 20,
      }),
      db.enrollment.findMany({
        where: {
          cohortId,
          status: 'ACTIVE',
          payments: {
            some: {
              status: 'SUCCEEDED',
              verifiedAt: { not: null },
              providerRef: { not: null },
              refundedMinor: 0,
            },
          },
        },
        include: { user: { select: { name: true } } },
        orderBy: { id: 'asc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
    ]);
    const current = query.class
      ? classes.find((c) => c.id === query.class)
      : null;
    return (
      <>
        {filter}
        {nav}
        <div className="learn-grid">
          <section className="learn-card">
            <h2>Class schedule</h2>
            <p>
              Times entered below use Asia/Kolkata (IST). Saved timestamps are
              UTC; displayed class times use IST.
            </p>
            <ActionForm
              key={current?.id ?? 'new'}
              action="class"
              values={{
                ...(current ? { id: current.id } : {}),
                version: current?.version ?? 0,
                cohortId,
              }}
              fields={[
                text('title', 'Class title', current?.title),
                text(
                  'description',
                  'Class description',
                  current?.description,
                  'textarea',
                ),
                text(
                  'startsAt',
                  'Starts at (IST)',
                  asLocal(current?.startsAt),
                  'datetime-local',
                ),
                text(
                  'endsAt',
                  'Ends at (IST)',
                  asLocal(current?.endsAt),
                  'datetime-local',
                ),
                {
                  ...text(
                    'meetingUrl',
                    'Actual HTTPS meeting link',
                    current?.meetingUrl ?? '',
                    'url',
                  ),
                  required: false,
                },
                {
                  ...text(
                    'recordingUrl',
                    'Actual HTTPS recording link',
                    current?.recordingUrl ?? '',
                    'url',
                  ),
                  required: false,
                },
                {
                  name: 'status',
                  label: 'Class status',
                  type: 'select',
                  value: current?.status ?? 'SCHEDULED',
                  options: [
                    'SCHEDULED',
                    'RESCHEDULED',
                    'CANCELLED',
                    'COMPLETED',
                  ].map((value) => ({ value, label: value })),
                },
              ]}
              button="Save class schedule"
            />
            <Link href={`?cohort=${cohortId}`}>Create another class</Link>
          </section>
          <section className="learn-card">
            <h2>Sessions & attendance</h2>
            {classes.length ? (
              classes.map((c) => (
                <details key={c.id}>
                  <summary>
                    {c.title} · {c.status}
                  </summary>
                  <p>{displayTime(c.startsAt)} IST</p>
                  <Link href={`?cohort=${cohortId}&class=${c.id}`}>
                    Edit / reschedule class
                  </Link>
                  {c.startsAt <= new Date() &&
                    c.status !== 'CANCELLED' &&
                    students.length > 0 && (
                      <ActionForm
                        action="attendance"
                        values={{ classId: c.id }}
                        fields={[
                          options(
                            'userId',
                            'Student',
                            students.map((s) => ({
                              id: s.userId,
                              title: s.user.name ?? s.userId,
                            })),
                          ),
                          {
                            name: 'status',
                            label: 'Attendance status',
                            type: 'select',
                            options: ['PRESENT', 'ABSENT', 'EXCUSED'].map(
                              (value) => ({ value, label: value }),
                            ),
                          },
                        ]}
                        button="Record attendance"
                      />
                    )}
                </details>
              ))
            ) : (
              <Empty title="No classes scheduled." />
            )}
            <Pagination
              page={page}
              hasNext={classes.length === 20 || students.length === 20}
              base={`cohort=${cohortId}&`}
            />
          </section>
        </div>
      </>
    );
  }
  if (section === 'assignments') {
    const [assignments, submissions] = await Promise.all([
      db.assignment.findMany({
        where: { cohortId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: 20,
      }),
      db.submission.findMany({
        where: {
          assignment: { cohortId },
          state: { in: ['SUBMITTED', 'GRADED'] },
        },
        include: {
          assignment: true,
          user: { select: { name: true } },
          attachments: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: 20,
      }),
    ]);
    const a = query.assignment
      ? assignments.find((a) => a.id === query.assignment)
      : null;
    return (
      <>
        {filter}
        {nav}
        <section className="learn-card">
          <h2>{a ? 'Edit assignment' : 'Create a cohort assignment'}</h2>
          <ActionForm
            key={a?.id ?? 'new'}
            action="assignment"
            values={{
              ...(a ? { id: a.id } : {}),
              cohortId,
              version: a?.version ?? 0,
            }}
            fields={[
              text('title', 'Assignment title', a?.title),
              text('instructions', 'Instructions', a?.instructions, 'textarea'),
              text(
                'dueAt',
                'Deadline (IST)',
                asLocal(a?.dueAt),
                'datetime-local',
              ),
              {
                name: 'rubric',
                label: 'Grading rubric',
                type: 'rubric',
                value: JSON.stringify(
                  a?.rubric ?? [
                    { criterion: 'Correctness and reasoning', points: 60 },
                    { criterion: 'Clarity and evidence', points: 40 },
                  ],
                  null,
                  2,
                ),
                hint: 'Define clear criteria and points. Rubrics are locked after submission.',
                required: true,
              },
              {
                ...text(
                  'resourceUrl',
                  'Resource URL',
                  a?.resourceUrl ?? '',
                  'url',
                ),
                required: false,
              },
              {
                name: 'allowResubmit',
                label: 'Allow resubmission after grading (before deadline)',
                type: 'checkbox',
                value: a?.allowResubmit ?? false,
              },
              state(a?.status),
            ]}
            button="Save assignment"
          />
          <div className="learn-link-row">
            {assignments.map((a) => (
              <Link href={`?cohort=${cohortId}&assignment=${a.id}`} key={a.id}>
                {a.title} · {a.status}
              </Link>
            ))}
          </div>
        </section>
        <section className="learn-card">
          <h2>Review queue & feedback history</h2>
          {submissions.length ? (
            submissions.map((s) => {
              const r = rubricSchema.safeParse(s.assignment.rubric);
              return (
                <details key={s.id}>
                  <summary>
                    {s.user.name ?? 'Student'} · {s.assignment.title} ·{' '}
                    {s.state}
                  </summary>
                  <p className="learn-meta">
                    Submission {s.id} · Revision {s.version} ·{' '}
                    {displayTime(s.submittedAt)} IST
                  </p>
                  <div className="learn-lesson-body">{s.body}</div>
                  {s.repositoryUrl && (
                    <a
                      href={s.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open evidence link
                    </a>
                  )}
                  {s.attachments.map((f) => (
                    <p key={f.id}>
                      <a href={`/api/learning/files/${f.id}`}>
                        Download {f.name}
                      </a>
                    </p>
                  ))}
                  {s.state === 'GRADED' ? (
                    <p>
                      {s.feedback} · Score {s.score}
                    </p>
                  ) : (
                    r.success && (
                      <ActionForm
                        action="grade"
                        values={{ submissionId: s.id, version: s.version }}
                        fields={[
                          {
                            name: 'scores',
                            label: 'Criterion scores',
                            type: 'scores',
                            options: r.data.map((x) => ({
                              label: x.criterion,
                              value: String(x.points),
                            })),
                            value: JSON.stringify(r.data.map(() => 0)),
                            hint: r.data
                              .map((x) => `${x.criterion}: 0–${x.points}`)
                              .join('; '),
                            required: true,
                          },
                          text(
                            'feedback',
                            'Actionable mentor feedback',
                            '',
                            'textarea',
                          ),
                        ]}
                        button="Publish grade & feedback"
                      />
                    )
                  )}
                </details>
              );
            })
          ) : (
            <Empty title="No submissions to review." />
          )}
          <Pagination
            page={page}
            hasNext={submissions.length === 20 || assignments.length === 20}
            base={`cohort=${cohortId}&`}
          />
        </section>
      </>
    );
  }
  if (section === 'assessments') {
    const quizzes = await db.assessment.findMany({
        where: { cohortId },
        orderBy: { id: 'asc' },
        skip,
        take: 20,
      }),
      results = await db.assessmentAttempt.findMany({
        where: { assessment: { cohortId } },
        include: {
          user: { select: { name: true } },
          assessment: { select: { title: true, maxScore: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: 20,
      });
    return (
      <>
        {filter}
        {nav}
        <section className="learn-card">
          <h2>Create an assessment</h2>
          <p>
            Answers are stored server-side. Students receive prompts/options
            only; scoring and attempt limits are enforced on the server.
          </p>
          <ActionForm
            action="quiz"
            values={{ version: 0, cohortId }}
            fields={[
              text('title', 'Assessment title'),
              text('dueAt', 'Assessment deadline (IST)', '', 'datetime-local'),
              {
                name: 'questions',
                label: 'Assessment questions',
                type: 'questions',
                value: JSON.stringify(
                  [
                    {
                      prompt: 'Replace with your approved assessment question',
                      options: ['First option', 'Second option'],
                      correctIndex: 0,
                    },
                  ],
                  null,
                  2,
                ),
                hint: 'Write each question, provide answer options, and choose the correct answer before publishing.',
                required: true,
              },
              {
                name: 'passPercent',
                label: 'Pass percentage',
                type: 'number',
                value: 70,
                min: 1,
                max: 100,
                required: true,
              },
              {
                name: 'maxAttempts',
                label: 'Maximum attempts',
                type: 'number',
                value: 1,
                min: 1,
                max: 10,
                required: true,
              },
              state(),
            ]}
            button="Save assessment"
          />
          {quizzes.map((q) => (
            <details key={q.id}>
              <summary>
                {q.title} · {q.status}
              </summary>
              <ActionForm
                action="quiz"
                values={{
                  id: q.id,
                  version: q.version,
                  cohortId,
                  title: q.title,
                  questions: q.questions,
                  passPercent: q.passPercent,
                  maxAttempts: q.maxAttempts,
                  dueAt: q.dueAt?.toISOString(),
                }}
                fields={[state(q.status)]}
                button="Update publication status"
              />
            </details>
          ))}
        </section>
        <section className="learn-card">
          <h2>Assessment results</h2>
          {results.length ? (
            <ul className="learn-list">
              {results.map((r) => (
                <li key={r.id}>
                  <h3>
                    {r.user.name ?? 'Student'} · {r.assessment.title}
                  </h3>
                  {r.score}/{r.assessment.maxScore} ·{' '}
                  {r.passed ? 'Passed' : 'Not passed'}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No assessment attempts." />
          )}
          <Pagination
            page={page}
            hasNext={results.length === 20 || quizzes.length === 20}
            base={`cohort=${cohortId}&`}
          />
        </section>
      </>
    );
  }
  const announcements = await db.announcement.findMany({
    where: { cohortId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: 20,
  });
  return (
    <>
      {filter}
      {nav}
      <section className="learn-card">
        <h2>Publish a cohort announcement</h2>
        <ActionForm
          action="announcement"
          values={{ cohortId }}
          fields={[
            text('title', 'Announcement title'),
            text('body', 'Announcement message', '', 'textarea'),
          ]}
          button="Publish announcement"
        />
      </section>
      <section className="learn-card">
        <h2>Published announcements</h2>
        {announcements.map((n) => (
          <article key={n.id}>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            <small className="learn-meta">{displayTime(n.createdAt)} IST</small>
          </article>
        ))}
        <Pagination
          page={page}
          hasNext={announcements.length === 20}
          base={`cohort=${cohortId}&`}
        />
      </section>
    </>
  );
}
