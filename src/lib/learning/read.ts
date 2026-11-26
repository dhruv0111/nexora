import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/domain/http';
import { ensure } from '@/lib/domain/errors';
import {
  paidWhere,
  studentAccess,
  cohortAccess,
  progressSummary,
} from './policy';
export async function courseLearning(userId: string, enrollmentId: string) {
  const e = await studentAccess(userId, enrollmentId),
    db = getDb();
  const [lessons, progress] = await Promise.all([
    db.lesson.findMany({
      where: { courseId: e.cohort.courseId, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        position: true,
        moduleId: true,
        prerequisiteId: true,
        kind: true,
        durationSeconds: true,
        module: { select: { title: true, startWeek: true } },
      },
      orderBy: { position: 'asc' },
      take: 500,
    }),
    db.lessonProgress.findMany({
      where: { enrollmentId: e.id, userId },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
  ]);
  const completed = new Set(
    progress.filter((p) => p.completedAt).map((p) => p.lessonId),
  );
  const available = (l: (typeof lessons)[number]) =>
    !l.prerequisiteId ||
    (completed.has(l.prerequisiteId) &&
      lessons.some((p) => p.id === l.prerequisiteId));
  const next = lessons.find((l) => !completed.has(l.id) && available(l));
  return {
    e,
    lessons,
    progress,
    completed,
    available,
    next,
    summary: progressSummary(lessons, completed),
  };
}
export async function studentHome(userId: string) {
  const db = getDb();
  const enrollments = await db.enrollment.findMany({
    where: {
      userId,
      ...paidWhere,
      cohort: {
        status: 'PUBLISHED',
        course: { status: 'PUBLISHED', contentApprovedAt: { not: null } },
      },
    },
    include: {
      cohort: {
        include: {
          course: {
            select: {
              title: true,
              modules: { orderBy: { startWeek: 'asc' }, take: 6 },
              lessons: {
                where: { status: 'PUBLISHED' },
                select: {
                  id: true,
                  moduleId: true,
                  position: true,
                  prerequisiteId: true,
                },
                orderBy: { position: 'asc' },
                take: 500,
              },
            },
          },
        },
      },
      lessonProgress: { take: 500, orderBy: { updatedAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const cohortIds = enrollments.map((e) => e.cohortId);
  const [
    classes,
    tasks,
    feedback,
    quizzes,
    announcements,
    notifications,
    pods,
  ] = await Promise.all([
    db.liveClass.findMany({
      where: {
        cohortId: { in: cohortIds },
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
        endsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
    }),
    db.assignment.findMany({
      where: {
        cohortId: { in: cohortIds },
        status: 'PUBLISHED',
        dueAt: { gte: new Date() },
        submissions: {
          none: { userId, state: { in: ['SUBMITTED', 'GRADED'] } },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
    db.submission.findMany({
      where: {
        userId,
        state: 'GRADED',
        assignment: { cohortId: { in: cohortIds }, status: 'PUBLISHED' },
      },
      include: { assignment: { select: { title: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
    }),
    db.assessmentAttempt.findMany({
      where: {
        userId,
        submittedAt: { not: null },
        assessment: { cohortId: { in: cohortIds }, status: 'PUBLISHED' },
      },
      include: { assessment: { select: { title: true, maxScore: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    }),
    db.announcement.findMany({
      where: { cohortId: { in: cohortIds } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.learningNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.podMember.findMany({
      where: {
        userId,
        leftAt: null,
        OR: [
          { enrollmentId: { in: enrollments.map((e) => e.id) } },
          { pod: { cohortId: { in: cohortIds }, projectId: null } },
        ],
      },
      include: { pod: { select: { name: true } } },
      take: 10,
    }),
  ]);
  return {
    now: Date.now(),
    enrollments,
    classes,
    tasks,
    feedback,
    quizzes,
    announcements,
    notifications,
    pods,
  };
}
export async function studentCohorts(userId: string) {
  return getDb().enrollment.findMany({
    where: {
      userId,
      ...paidWhere,
      cohort: {
        status: 'PUBLISHED',
        course: { status: 'PUBLISHED', contentApprovedAt: { not: null } },
      },
    },
    include: { cohort: { select: { id: true, name: true, courseId: true } } },
    take: 20,
  });
}
export async function staffCohorts(actor: Actor) {
  ensure(
    ['MENTOR', 'ADMIN'].includes(actor.role),
    403,
    'STAFF',
    'Staff access required.',
  );
  return getDb().cohort.findMany({
    where:
      actor.role === 'MENTOR'
        ? {
            mentors: {
              some: { mentor: { userId: actor.id, user: { role: 'MENTOR' } } },
            },
          }
        : {},
    include: {
      course: { select: { title: true } },
      _count: { select: { enrollments: { where: paidWhere } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
export async function cohortOverview(actor: Actor, cohortId: string, page = 1) {
  const c = await cohortAccess(actor, cohortId),
    db = getDb();
  const students = await db.enrollment.findMany({
    where: { cohortId: c.id, ...paidWhere },
    include: {
      user: { select: { id: true, name: true } },
      lessonProgress: { orderBy: { updatedAt: 'desc' }, take: 500 },
    },
    orderBy: { id: 'asc' },
    skip: (page - 1) * 20,
    take: 20,
  });
  const ids = students.map((s) => s.userId);
  const [lessons, assignments, submissions, attendance, results, classes] =
    await Promise.all([
      db.lesson.findMany({
        where: { courseId: c.courseId, status: 'PUBLISHED' },
        select: { id: true, moduleId: true },
        take: 500,
      }),
      db.assignment.findMany({
        where: { cohortId: c.id, status: 'PUBLISHED' },
        orderBy: { dueAt: 'desc' },
        take: 100,
      }),
      db.submission.findMany({
        where: {
          userId: { in: ids },
          assignment: { cohortId: c.id, status: 'PUBLISHED' },
        },
        select: { id: true, userId: true, assignmentId: true, state: true },
        take: 2000,
      }),
      db.attendance.findMany({
        where: {
          userId: { in: ids },
          liveClass: { cohortId: c.id, status: { not: 'CANCELLED' } },
        },
        select: { userId: true, status: true },
        take: 2000,
      }),
      db.assessmentAttempt.findMany({
        where: { userId: { in: ids }, assessment: { cohortId: c.id } },
        select: { userId: true, score: true, passed: true },
        take: 2000,
      }),
      db.liveClass.findMany({
        where: { cohortId: c.id },
        orderBy: { startsAt: 'desc' },
        take: 20,
      }),
    ]);
  return {
    now: Date.now(),
    c,
    students,
    lessons,
    assignments,
    submissions,
    attendance,
    results,
    classes,
  };
}
