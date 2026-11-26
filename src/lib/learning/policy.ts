import 'server-only';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import type { Tx } from '@/lib/domain/transaction';
import type { Actor } from '@/lib/domain/http';
export const paidWhere = {
  status: 'ACTIVE' as const,
  payments: {
    some: {
      status: 'SUCCEEDED' as const,
      verifiedAt: { not: null },
      providerRef: { not: null },
      refundedMinor: 0,
    },
  },
};
export async function studentAccess(
  userId: string,
  enrollmentId: string,
  db: Tx = getDb(),
) {
  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId, userId, ...paidWhere },
    include: { cohort: { include: { course: true } } },
  });
  ensure(
    e &&
      e.cohort.course.status === 'PUBLISHED' &&
      e.cohort.course.contentApprovedAt &&
      e.cohort.status === 'PUBLISHED',
    403,
    'LEARNING_ACCESS',
    'A verified paid enrollment in a published course is required.',
  );
  return e;
}
export async function cohortAccess(
  actor: Actor,
  cohortId: string,
  db: Tx = getDb(),
) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  ensure(
    user?.role === actor.role && ['ADMIN', 'MENTOR'].includes(actor.role),
    403,
    'STAFF',
    'Staff access is required.',
  );
  const c = await db.cohort.findFirst({
    where: {
      id: cohortId,
      ...(actor.role === 'MENTOR'
        ? {
            mentors: {
              some: { mentor: { userId: actor.id, user: { role: 'MENTOR' } } },
            },
          }
        : {}),
    },
  });
  ensure(c, 404, 'COHORT', 'Cohort not found.');
  return c;
}
export function pageNumber(value?: string) {
  const n = Number(value ?? '1');
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
}
export function displayTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function progressSummary(
  lessons: { id: string; moduleId: string | null }[],
  completed: Set<string>,
) {
  const count = lessons.filter((l) => completed.has(l.id)).length;
  return {
    total: lessons.length,
    completed: count,
    percent: lessons.length ? Math.floor((count / lessons.length) * 100) : 0,
  };
}
