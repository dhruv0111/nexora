import { fixture, testGateway } from './fixtures';
import { startCheckout, applyProviderState } from '@/lib/payments/enrollment';
import { editLesson } from '@/lib/learning/content';
export async function learningFixture() {
  const f = await fixture(),
    db = f.db;
  const mentor = await db.user.create({
      data: {
        id: `${f.course.id}mentor`,
        name: 'Isolated mentor',
        role: 'MENTOR',
      },
    }),
    unrelated = await db.user.create({
      data: {
        id: `${f.course.id}othermentor`,
        name: 'Unassigned mentor',
        role: 'MENTOR',
      },
    });
  const profile = await db.mentor.create({
    data: { userId: mentor.id, expertise: ['Isolated testing'] },
  });
  await db.cohortMentor.create({
    data: { cohortId: f.cohort.id, mentorId: profile.id },
  });
  const app = await f.accepted(),
    g = testGateway(),
    o = await startCheckout(
      f.student.id,
      {
        applicationId: app.id,
        cohortId: f.cohort.id,
        priceVersion: 1,
        termsVersion: 'test-v1',
        agree: true,
      },
      g.api,
    ),
    p = g.capture(o.orderId);
  await applyProviderState(g.orders.get(o.orderId)!, p, null, g.api);
  await db.cohort.update({
    where: { id: f.cohort.id },
    data: { startsAt: new Date(Date.now() - 10 * 86400000) },
  });
  const learningModule = await db.curriculumModule.findFirstOrThrow({
    where: { courseId: f.course.id },
    orderBy: { startWeek: 'asc' },
  });
  const adminActor = { id: f.admin.id, role: 'ADMIN' as const },
    mentorActor = { id: mentor.id, role: 'MENTOR' as const },
    otherActor = { id: unrelated.id, role: 'MENTOR' as const };
  const base = {
    courseId: f.course.id,
    moduleId: learningModule.id,
    version: 0,
    title: 'First isolated learning lesson',
    position: 1,
    kind: 'RESOURCE',
    content:
      'Isolated content for real persistence tests. Not approved Nexora learning material.',
    videoUrl: '',
    resourceUrl: '',
    durationSeconds: 0,
    prerequisiteId: '',
    status: 'PUBLISHED',
  };
  const first = await editLesson(adminActor, base),
    second = await editLesson(adminActor, {
      ...base,
      title: 'Next isolated lesson',
      position: 2,
      prerequisiteId: first.id,
    }),
    draft = await editLesson(adminActor, {
      ...base,
      title: 'Hidden draft learning material',
      position: 3,
      status: 'DRAFT',
    });
  async function cleanup() {
    await db.supportTicket.deleteMany({
      where: { userId: { in: [f.student.id, f.second.id] } },
    });
    await db.learningNotification.deleteMany({
      where: { userId: { in: [f.student.id, f.second.id] } },
    });
    await db.submission.deleteMany({
      where: { assignment: { cohortId: f.cohort.id } },
    });
    await db.assignment.deleteMany({ where: { cohortId: f.cohort.id } });
    await db.assessmentAttempt.deleteMany({
      where: { assessment: { courseId: f.course.id } },
    });
    await db.assessment.deleteMany({ where: { courseId: f.course.id } });
    await db.lesson.updateMany({
      where: { courseId: f.course.id },
      data: { prerequisiteId: null },
    });
    await db.lesson.deleteMany({ where: { courseId: f.course.id } });
    await db.auditLog.deleteMany({
      where: { actorId: { in: [mentor.id, unrelated.id] } },
    });
    await f.cleanup();
    await db.user.deleteMany({
      where: { id: { in: [mentor.id, unrelated.id] } },
    });
  }
  return {
    ...f,
    otherStudent: f.second,
    mentor,
    unrelated,
    profile,
    adminActor,
    mentorActor,
    otherActor,
    enrollmentId: o.enrollmentId,
    paymentId: o.paymentId,
    first,
    second,
    draft,
    module: learningModule,
    cleanup,
  };
}
