import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { learningFixture } from './learning-fixture';
import { editCourse } from '@/lib/catalog/admin';
import {
  lessonForStudent,
  recordProgress,
  editLesson,
} from '@/lib/learning/content';
import { studentAccess, cohortAccess } from '@/lib/learning/policy';
import { courseLearning, studentHome } from '@/lib/learning/read';
import {
  saveAssignment,
  submitAssignment,
  gradeSubmission,
  saveQuiz,
  attemptQuiz,
} from '@/lib/learning/tasks';
import {
  scheduleClass,
  recordAttendance,
  announce,
  openTicket,
  replyTicket,
  ticketAccess,
} from '@/lib/learning/community';
import { uploadFile, downloadFile } from '@/lib/learning/files';
let f: Awaited<ReturnType<typeof learningFixture>>;
beforeEach(async () => {
  f = await learningFixture();
});
afterEach(async () => {
  await f?.cleanup();
});
const future = () => new Date(Date.now() + 86400000).toISOString();
async function assignment() {
  return saveAssignment(f.mentorActor, {
    version: 0,
    cohortId: f.cohort.id,
    title: 'Isolated practice assignment',
    instructions: 'Explain your implementation decisions with evidence.',
    dueAt: future(),
    status: 'PUBLISHED',
    allowResubmit: true,
    rubric: [
      { criterion: 'Reasoning', points: 60 },
      { criterion: 'Evidence', points: 40 },
    ],
    resourceUrl: '',
  });
}
const submit = (assignmentId: string, version = 0, action = 'submit') => ({
  assignmentId,
  enrollmentId: f.enrollmentId,
  version,
  action,
  body: 'A substantive explanation with test evidence.',
  repositoryUrl: '',
});
describe('Phase 4 real PostgreSQL learning and permission invariants', () => {
  it('blocks unpaid, cross-student, draft and prerequisite-locked lesson access', async () => {
    await expect(
      studentAccess(f.second.id, f.enrollmentId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      lessonForStudent(f.student.id, f.enrollmentId, f.draft.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      lessonForStudent(f.student.id, f.enrollmentId, f.second.id),
    ).rejects.toMatchObject({ code: 'LESSON_LOCKED' });
    expect(
      (await lessonForStudent(f.student.id, f.enrollmentId, f.first.id)).lesson
        .id,
    ).toBe(f.first.id);
    await f.db.payment.update({
      where: { id: f.paymentId },
      data: { status: 'PENDING' },
    });
    await expect(
      studentAccess(f.student.id, f.enrollmentId),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('persists idempotent completion, calculates real progress and opens the correct next lesson', async () => {
    expect((await courseLearning(f.student.id, f.enrollmentId)).next?.id).toBe(
      f.first.id,
    );
    const input = {
      enrollmentId: f.enrollmentId,
      lessonId: f.first.id,
      positionSeconds: 0,
      complete: true,
    };
    await recordProgress(f.student.id, input);
    await recordProgress(f.student.id, input);
    const d = await courseLearning(f.student.id, f.enrollmentId);
    expect(d.summary).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(d.next?.id).toBe(f.second.id);
    expect(
      await f.db.lessonProgress.count({
        where: { enrollmentId: f.enrollmentId },
      }),
    ).toBe(1);
    expect(
      await f.db.auditLog.count({
        where: { actorId: f.student.id, action: 'LESSON_COMPLETED' },
      }),
    ).toBe(1);
    await expect(
      recordProgress(f.student.id, { ...input, percent: 100 }),
    ).rejects.toBeTruthy();
    await expect(
      recordProgress(f.student.id, { ...input, positionSeconds: 1 }),
    ).rejects.toMatchObject({ code: 'POSITION' });
  });
  it('persists video resume position without claiming lesson completion', async () => {
    await f.db.lesson.update({
      where: { id: f.first.id },
      data: {
        kind: 'VIDEO',
        videoUrl: 'https://media.invalid/isolated-test.mp4',
        captionsUrl: 'https://media.invalid/isolated-test.vtt',
        durationSeconds: 600,
      },
    });
    await recordProgress(f.student.id, {
      enrollmentId: f.enrollmentId,
      lessonId: f.first.id,
      positionSeconds: 123,
      complete: false,
    });
    const view = await lessonForStudent(
      f.student.id,
      f.enrollmentId,
      f.first.id,
    );
    expect(view.progress?.positionSeconds).toBe(123);
    expect(view.progress?.completedAt).toBeNull();
    expect(
      (await courseLearning(f.student.id, f.enrollmentId)).summary.percent,
    ).toBe(0);
  });
  it('preserves learning module identities when the admissions course editor saves revisions', async () => {
    const c = await f.db.course.findUniqueOrThrow({
      where: { id: f.course.id },
      include: { modules: { orderBy: { startWeek: 'asc' } } },
    });
    await editCourse(f.admin.id, c.id, {
      version: c.version,
      title: c.title,
      description: c.description,
      audience: c.audience,
      prerequisites: c.prerequisites,
      skills: c.skills,
      technologies: c.technologies,
      durationWeeks: 24,
      deliveryFormat: c.deliveryFormat,
      assessmentRequired: c.assessmentRequired,
      modules: c.modules.map(({ startWeek, title, summary, weeklyTopics }) => ({
        startWeek,
        title,
        summary,
        weeklyTopics,
      })),
      status: 'PUBLISHED',
      previewVisible: false,
      contentSource: c.contentSource!,
      approveContent: true,
      priceMinor: c.priceMinor,
      currency: 'INR',
      approvePrice: true,
      termsVersion: c.termsVersion!,
      enrollmentTerms: c.enrollmentTerms!,
      refundPolicy: c.refundPolicy!,
      approveTerms: true,
      mentorIds: [],
    });
    expect(
      (await f.db.lesson.findUniqueOrThrow({ where: { id: f.first.id } }))
        .moduleId,
    ).toBe(f.module.id);
    expect(
      await f.db.curriculumModule.count({ where: { courseId: c.id } }),
    ).toBe(6);
  });
  it('keeps lesson revisions and rejects cyclic prerequisites or stale content edits', async () => {
    const l = await f.db.lesson.findUniqueOrThrow({
      where: { id: f.first.id },
    });
    const body = {
      id: l.id,
      version: l.version,
      courseId: f.course.id,
      moduleId: f.module.id,
      title: 'Updated learning notes',
      position: 1,
      kind: 'RESOURCE',
      content: 'An updated explanation retaining the earlier revision.',
      videoUrl: '',
      resourceUrl: '',
      durationSeconds: 0,
      prerequisiteId: '',
      status: 'PUBLISHED',
    };
    await editLesson(f.adminActor, body);
    expect(await f.db.lessonRevision.count({ where: { lessonId: l.id } })).toBe(
      1,
    );
    await expect(editLesson(f.adminActor, body)).rejects.toMatchObject({
      code: 'VERSION',
    });
    await expect(
      editLesson(f.adminActor, {
        ...body,
        version: 2,
        prerequisiteId: f.second.id,
      }),
    ).rejects.toMatchObject({ code: 'PREREQUISITE' });
  });
  it('isolates mentor cohorts and roster data', async () => {
    expect((await cohortAccess(f.mentorActor, f.cohort.id)).id).toBe(
      f.cohort.id,
    );
    await expect(cohortAccess(f.otherActor, f.cohort.id)).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(
      saveAssignment(f.otherActor, {
        version: 0,
        cohortId: f.cohort.id,
        title: 'Unauthorized assignment',
        instructions: 'This must never be published by an unrelated mentor.',
        dueAt: future(),
        status: 'PUBLISHED',
        allowResubmit: false,
        rubric: [{ criterion: 'Reasoning', points: 100 }],
        resourceUrl: '',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('supports draft, exact retry, rubric grading, feedback and permitted resubmission', async () => {
    const a = await assignment();
    const draft = await submitAssignment(f.student.id, submit(a.id, 0, 'save'));
    const s = await submitAssignment(f.student.id, submit(a.id, draft.version));
    expect(
      (await submitAssignment(f.student.id, submit(a.id, draft.version))).id,
    ).toBe(s.id);
    await expect(
      gradeSubmission(f.otherActor, {
        submissionId: s.id,
        version: s.version,
        scores: [50, 30],
        feedback: 'Should not be accepted.',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      gradeSubmission(f.mentorActor, {
        submissionId: s.id,
        version: s.version,
        scores: [61, 30],
        feedback: 'Should not exceed rubric.',
      }),
    ).rejects.toMatchObject({ code: 'RUBRIC' });
    await gradeSubmission(f.mentorActor, {
      submissionId: s.id,
      version: s.version,
      scores: [50, 30],
      feedback: 'Good reasoning. Add a test for the empty input case.',
    });
    const graded = await f.db.submission.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(graded.score).toBe(80);
    expect(graded.feedback).toContain('empty input');
    const task = await f.db.assignment.findUniqueOrThrow({
      where: { id: a.id },
    });
    await saveAssignment(f.mentorActor, {
      id: task.id,
      version: task.version,
      cohortId: task.cohortId,
      title: task.title,
      instructions: task.instructions,
      dueAt: task.dueAt!.toISOString(),
      status: 'PUBLISHED',
      allowResubmit: true,
      rubric: [
        { criterion: 'Reasoning', points: 60 },
        { criterion: 'Evidence', points: 40 },
      ],
      resourceUrl: '',
    });
    const resubmitted = await submitAssignment(f.student.id, {
      ...submit(a.id, graded.version),
      body: 'Updated solution with an explicit empty-input regression test.',
    });
    expect(resubmitted.state).toBe('SUBMITTED');
    expect(
      await f.db.submissionRevision.count({ where: { submissionId: s.id } }),
    ).toBeGreaterThanOrEqual(3);
    expect(
      (await studentHome(f.student.id)).notifications.length,
    ).toBeGreaterThan(0);
  });
  it('rejects submissions after deadline and disallowed resubmission', async () => {
    const a = await assignment();
    const s = await submitAssignment(f.student.id, submit(a.id));
    await expect(
      submitAssignment(f.student.id, {
        ...submit(a.id, s.version),
        body: 'Trying to change the submitted assignment.',
      }),
    ).rejects.toMatchObject({ code: 'RESUBMIT' });
    const expired = await assignment();
    await f.db.assignment.update({
      where: { id: expired.id },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    await expect(
      submitAssignment(f.student.id, submit(expired.id, 0, 'save')),
    ).rejects.toMatchObject({ code: 'DEADLINE' });
  });
  it('stores files privately, enforces type/quota and rejects cross-user downloads', async () => {
    const a = await assignment(),
      s = await submitAssignment(f.student.id, submit(a.id, 0, 'save'));
    const file = await uploadFile(
      f.student.id,
      s.id,
      f.enrollmentId,
      new File(['Private learning evidence'], 'evidence.txt', {
        type: 'text/plain',
      }),
    );
    expect(
      (await downloadFile({ id: f.student.id, role: 'STUDENT' }, file.id)).size,
    ).toBe(25);
    await expect(
      downloadFile({ id: f.second.id, role: 'STUDENT' }, file.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(downloadFile(f.otherActor, file.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      uploadFile(
        f.student.id,
        s.id,
        f.enrollmentId,
        new File(['not a pdf'], 'fake.pdf', { type: 'application/pdf' }),
      ),
    ).rejects.toMatchObject({ code: 'FILE_TYPE' });
    await uploadFile(
      f.student.id,
      s.id,
      f.enrollmentId,
      new File(['Second evidence'], 'second.txt', { type: 'text/plain' }),
    );
    await uploadFile(
      f.student.id,
      s.id,
      f.enrollmentId,
      new File(['Third evidence'], 'third.txt', { type: 'text/plain' }),
    );
    await expect(
      uploadFile(
        f.student.id,
        s.id,
        f.enrollmentId,
        new File(['Fourth evidence'], 'fourth.txt', { type: 'text/plain' }),
      ),
    ).rejects.toMatchObject({ code: 'FILE_QUOTA' });
    await submitAssignment(f.student.id, submit(a.id, s.version));
    await expect(
      uploadFile(
        f.student.id,
        s.id,
        f.enrollmentId,
        new File(['later'], 'later.txt', { type: 'text/plain' }),
      ),
    ).rejects.toMatchObject({ code: 'FILE_LOCKED' });
  });
  it('scores quizzes on the server, enforces attempts/deadlines and replays safely', async () => {
    const q = await saveQuiz(f.mentorActor, {
      version: 0,
      cohortId: f.cohort.id,
      title: 'Isolated knowledge check',
      questions: [
        {
          prompt: 'Which assertion checks equality?',
          options: ['expect(a).toBe(b)', 'console.log(a)'],
          correctIndex: 0,
        },
      ],
      passPercent: 70,
      maxAttempts: 1,
      dueAt: future(),
      status: 'PUBLISHED',
    });
    const b = {
      enrollmentId: f.enrollmentId,
      assessmentId: q.id,
      version: 1,
      requestKey: randomUUID(),
      answers: [0],
    };
    const a = await attemptQuiz(f.student.id, b);
    expect(a).toMatchObject({ score: 1, passed: true });
    expect((await attemptQuiz(f.student.id, b)).id).toBe(a.id);
    await expect(
      attemptQuiz(f.student.id, { ...b, requestKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'ATTEMPT_LIMIT' });
    await expect(
      attemptQuiz(f.student.id, { ...b, requestKey: randomUUID(), score: 100 }),
    ).rejects.toBeTruthy();
    await f.db.assessment.update({
      where: { id: q.id },
      data: { maxAttempts: 2, dueAt: new Date(Date.now() - 1000) },
    });
    await expect(
      attemptQuiz(f.student.id, { ...b, requestKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'DEADLINE' });
    const saved = await f.db.assessment.findUniqueOrThrow({
      where: { id: q.id },
    });
    const edit = {
      id: q.id,
      version: saved.version,
      cohortId: f.cohort.id,
      title: saved.title,
      questions: [
        {
          prompt: 'Which assertion checks equality?',
          options: ['expect(a).toBe(b)', 'console.log(a)'],
          correctIndex: 0,
        },
      ],
      passPercent: saved.passPercent,
      maxAttempts: saved.maxAttempts,
      dueAt: saved.dueAt!.toISOString(),
      status: 'ARCHIVED',
    };
    await expect(
      saveQuiz(f.mentorActor, { ...edit, passPercent: 10 }),
    ).rejects.toMatchObject({ code: 'ATTEMPTS_EXIST' });
    await saveQuiz(f.mentorActor, edit);
    expect(
      (await f.db.assessment.findUniqueOrThrow({ where: { id: q.id } })).status,
    ).toBe('ARCHIVED');
  });
  it('schedules, reschedules and cancels classes; attendance requires an eligible student', async () => {
    const b = {
      version: 0,
      cohortId: f.cohort.id,
      title: 'Isolated live session',
      description: 'A real persisted schedule in the isolated fixture.',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      meetingUrl: '',
      recordingUrl: '',
      status: 'SCHEDULED',
    };
    const c = await scheduleClass(f.mentorActor, b);
    await recordAttendance(f.mentorActor, {
      classId: c.id,
      userId: f.student.id,
      status: 'PRESENT',
    });
    await expect(
      recordAttendance(f.mentorActor, {
        classId: c.id,
        userId: f.second.id,
        status: 'PRESENT',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      recordAttendance(f.otherActor, {
        classId: c.id,
        userId: f.student.id,
        status: 'ABSENT',
      }),
    ).rejects.toMatchObject({ status: 404 });
    await scheduleClass(f.mentorActor, {
      ...b,
      id: c.id,
      version: 1,
      status: 'RESCHEDULED',
    });
    await scheduleClass(f.mentorActor, {
      ...b,
      id: c.id,
      version: 2,
      status: 'CANCELLED',
    });
    await expect(
      recordAttendance(f.mentorActor, {
        classId: c.id,
        userId: f.student.id,
        status: 'PRESENT',
      }),
    ).rejects.toMatchObject({ code: 'CLASS_TIME' });
    expect(
      await f.db.learningNotification.count({
        where: { userId: f.student.id },
      }),
    ).toBe(3);
  });
  it('keeps support conversations private and supports admin assignment and resolution', async () => {
    const t = await openTicket(f.student.id, {
      requestKey: randomUUID(),
      subject: 'Need help with a lesson',
      category: 'LEARNING',
      priority: 'HIGH',
      body: 'I need help understanding this lesson explanation.',
    });
    await expect(
      ticketAccess({ id: f.second.id, role: 'STUDENT' }, t.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(ticketAccess(f.mentorActor, t.id)).rejects.toMatchObject({
      status: 404,
    });
    await replyTicket(f.adminActor, {
      ticketId: t.id,
      version: 1,
      body: 'Here is a practical way to approach the lesson.',
      status: 'RESOLVED',
      assigneeId: f.admin.id,
    });
    expect(
      (await ticketAccess({ id: f.student.id, role: 'STUDENT' }, t.id)).status,
    ).toBe('RESOLVED');
    await expect(
      replyTicket(
        { id: f.student.id, role: 'STUDENT' },
        {
          ticketId: t.id,
          version: 2,
          body: 'Assign myself.',
          status: 'RESOLVED',
        },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('restricts cohort announcements and excludes unrelated students', async () => {
    await announce(f.mentorActor, {
      cohortId: f.cohort.id,
      title: 'A cohort update',
      body: 'Prepare your questions for the next live session.',
    });
    expect((await studentHome(f.student.id)).announcements).toHaveLength(1);
    expect((await studentHome(f.second.id)).announcements).toHaveLength(0);
    await expect(
      announce(f.otherActor, {
        cohortId: f.cohort.id,
        title: 'Not permitted',
        body: 'This should never reach unrelated students.',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
