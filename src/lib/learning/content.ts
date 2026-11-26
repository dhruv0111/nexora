import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { cohortAccess, studentAccess } from './policy';
const id = z.string().min(1).max(100);
export const httpsUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2000)
    .refine((v) => {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    }, 'Use an HTTPS URL without credentials.'),
]);
export const lessonSchema = z
  .object({
    id: id.optional(),
    courseId: id,
    moduleId: id,
    version: z.number().int().nonnegative(),
    title: z.string().trim().min(3).max(160),
    position: z.number().int().min(1).max(10000),
    kind: z.enum(['VIDEO', 'RESOURCE']),
    content: z.string().trim().min(10).max(50000),
    videoUrl: httpsUrl,
    captionsUrl: httpsUrl.default(''),
    resourceUrl: httpsUrl,
    durationSeconds: z.number().int().min(0).max(86400),
    prerequisiteId: z.union([id, z.literal('')]),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  })
  .strict();
export async function editLesson(actor: Actor, input: unknown) {
  const b = lessonSchema.parse(input);
  return serial(async (tx) => {
    ensure(
      actor.role === 'ADMIN' &&
        (await tx.user.findUnique({ where: { id: actor.id } }))?.role ===
          'ADMIN',
      403,
      'ADMIN',
      'Administrator access is required.',
    );
    await lock(tx, `lesson-course:${b.courseId}`);
    const course = await tx.course.findUnique({ where: { id: b.courseId } });
    ensure(course, 404, 'COURSE', 'Course not found.');
    const mod = await tx.curriculumModule.findFirst({
      where: { id: b.moduleId, courseId: b.courseId },
    });
    ensure(mod, 422, 'MODULE', 'Choose a module in this course.');
    if (b.status === 'PUBLISHED')
      ensure(
        course.status === 'PUBLISHED' && course.contentApprovedAt,
        409,
        'CONTENT',
        'Approved published course content is required.',
      );
    if (b.kind === 'VIDEO')
      ensure(
        b.videoUrl && b.captionsUrl,
        422,
        'VIDEO',
        'Provide actual HTTPS video and WebVTT caption resources.',
      );
    if (b.prerequisiteId) {
      const p = await tx.lesson.findFirst({
        where: {
          id: b.prerequisiteId,
          courseId: b.courseId,
          status: 'PUBLISHED',
          position: { lt: b.position },
        },
      });
      ensure(
        p && p.id !== b.id,
        422,
        'PREREQUISITE',
        'Prerequisite must be an earlier published lesson in this course.',
      );
    }
    const current = b.id
      ? await tx.lesson.findFirst({ where: { id: b.id, courseId: b.courseId } })
      : null;
    ensure(
      b.id ? current?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Lesson changed. Reload before saving.',
    );
    if (!current)
      ensure(
        (await tx.lesson.count({ where: { courseId: b.courseId } })) < 500,
        409,
        'LESSON_LIMIT',
        'A course supports up to 500 lessons.',
      );
    if (current) {
      // Reordering cannot turn existing dependencies into cycles or unlock hidden prerequisites.
      const dependents = await tx.lesson.findMany({
        where: { prerequisiteId: current.id },
        take: 10000,
        select: { position: true, status: true },
      });
      ensure(
        dependents.every(
          (d) =>
            d.position > b.position &&
            (d.status !== 'PUBLISHED' || b.status === 'PUBLISHED'),
        ),
        409,
        'DEPENDENTS',
        'Update dependent lessons before moving or hiding this prerequisite.',
      );
      await tx.lessonRevision.create({
        data: {
          lessonId: current.id,
          version: current.version,
          snapshot: JSON.parse(JSON.stringify(current)),
        },
      });
    }
    const data = {
      courseId: b.courseId,
      moduleId: b.moduleId,
      title: b.title,
      position: b.position,
      kind: b.kind,
      content: b.content,
      videoUrl: b.videoUrl || null,
      captionsUrl: b.captionsUrl || null,
      resourceUrl: b.resourceUrl || null,
      durationSeconds: b.durationSeconds,
      prerequisiteId: b.prerequisiteId || null,
      status: b.status,
    };
    const lesson = current
      ? await tx.lesson.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.lesson.create({ data });
    await audit(tx, actor.id, 'LESSON_SAVED', 'Lesson', lesson.id, {
      version: lesson.version,
      status: lesson.status,
    });
    return { id: lesson.id, version: lesson.version };
  });
}
export async function lessonForStudent(
  userId: string,
  enrollmentId: string,
  lessonId: string,
) {
  const e = await studentAccess(userId, enrollmentId);
  const db = getDb();
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, courseId: e.cohort.courseId, status: 'PUBLISHED' },
    include: { module: true },
  });
  ensure(lesson, 404, 'LESSON', 'Lesson not found.');
  if (lesson.prerequisiteId) {
    const p = await db.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId,
          lessonId: lesson.prerequisiteId,
        },
      },
    });
    const prereq = await db.lesson.findUnique({
      where: { id: lesson.prerequisiteId },
      select: { status: true },
    });
    ensure(
      p?.completedAt && prereq?.status === 'PUBLISHED',
      403,
      'LESSON_LOCKED',
      'Complete the prerequisite lesson first.',
    );
  }
  return {
    e,
    lesson,
    progress: await db.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    }),
  };
}
export const completionSchema = z
  .object({
    enrollmentId: id,
    lessonId: id,
    positionSeconds: z.number().int().min(0).max(86400),
    complete: z.boolean(),
  })
  .strict();
export async function recordProgress(userId: string, input: unknown) {
  const b = completionSchema.parse(input);
  return serial(async (tx) => {
    await lock(tx, `learning:${b.enrollmentId}`);
    const e = await studentAccess(userId, b.enrollmentId, tx);
    const l = await tx.lesson.findFirst({
      where: {
        id: b.lessonId,
        courseId: e.cohort.courseId,
        status: 'PUBLISHED',
      },
    });
    ensure(l, 404, 'LESSON', 'Lesson not found.');
    if (l.prerequisiteId) {
      const p = await tx.lessonProgress.findUnique({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: e.id,
            lessonId: l.prerequisiteId,
          },
        },
      });
      const prereq = await tx.lesson.findUnique({
        where: { id: l.prerequisiteId },
        select: { status: true },
      });
      ensure(
        p?.completedAt && prereq?.status === 'PUBLISHED',
        403,
        'LESSON_LOCKED',
        'Complete the prerequisite lesson first.',
      );
    }
    ensure(
      b.positionSeconds <= l.durationSeconds,
      422,
      'POSITION',
      'Resume position exceeds the lesson duration.',
    );
    const where = {
      enrollmentId_lessonId: { enrollmentId: e.id, lessonId: l.id },
    };
    const old = await tx.lessonProgress.findUnique({ where });
    const completedAt = old?.completedAt ?? (b.complete ? new Date() : null);
    const p = await tx.lessonProgress.upsert({
      where,
      create: {
        enrollmentId: e.id,
        lessonId: l.id,
        userId,
        positionSeconds: b.positionSeconds,
        completedAt,
      },
      update: { positionSeconds: b.positionSeconds, completedAt },
    });
    if (!old?.completedAt && completedAt)
      await audit(tx, userId, 'LESSON_COMPLETED', 'Lesson', l.id, {
        enrollmentId: e.id,
        version: l.version,
      });
    return { id: p.id, completed: !!p.completedAt };
  });
}
export async function assignMentor(actor: Actor, input: unknown) {
  const b = z
    .object({ cohortId: id, mentorId: id, remove: z.boolean() })
    .strict()
    .parse(input);
  ensure(
    actor.role === 'ADMIN',
    403,
    'ADMIN',
    'Administrator access required.',
  );
  return serial(async (tx) => {
    await cohortAccess(actor, b.cohortId, tx);
    const m = await tx.mentor.findFirst({
      where: { id: b.mentorId, user: { role: 'MENTOR' } },
    });
    ensure(m, 422, 'MENTOR', 'Select an existing mentor-role profile.');
    if (b.remove)
      await tx.cohortMentor.deleteMany({
        where: { cohortId: b.cohortId, mentorId: b.mentorId },
      });
    else
      await tx.cohortMentor.upsert({
        where: {
          cohortId_mentorId: { cohortId: b.cohortId, mentorId: b.mentorId },
        },
        create: { cohortId: b.cohortId, mentorId: b.mentorId },
        update: {},
      });
    await audit(tx, actor.id, 'COHORT_MENTOR_CHANGED', 'Cohort', b.cohortId, {
      mentorId: b.mentorId,
      removed: b.remove,
    });
    return { saved: true };
  });
}
