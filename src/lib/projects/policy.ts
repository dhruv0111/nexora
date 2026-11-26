import 'server-only';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import { studentAccess, cohortAccess } from '@/lib/learning/policy';
import type { Tx } from '@/lib/domain/transaction';
import type { Actor } from '@/lib/domain/http';
export async function projectAccess(a: Actor, id: string, db: Tx = getDb()) {
  const user = await db.user.findUnique({
    where: { id: a.id },
    select: { role: true },
  });
  ensure(
    user?.role === a.role,
    403,
    'ROLE',
    'Your account permissions changed.',
  );
  const p = await db.project.findFirst({
    where: {
      id,
      ...(a.role === 'ADMIN'
        ? {}
        : a.role === 'MENTOR'
          ? { staff: { some: { userId: a.id } } }
          : {
              pods: {
                some: {
                  members: {
                    some: {
                      userId: a.id,
                      leftAt: null,
                      enrollmentId: { not: null },
                    },
                  },
                },
              },
            }),
    },
  });
  ensure(
    p && ['ADMIN', 'MENTOR', 'STUDENT'].includes(a.role),
    404,
    'PROJECT',
    'Project not found.',
  );
  return p;
}
export async function podAccess(
  a: Actor,
  id: string,
  db: Tx = getDb(),
  staff = false,
) {
  const pod = await db.agilePod.findUnique({
    where: { id },
    include: { project: true },
  });
  ensure(pod?.projectId && pod.project, 404, 'POD', 'Project pod not found.');
  await projectAccess(a, pod.projectId, db);
  if (staff)
    ensure(
      a.role === 'ADMIN' || a.role === 'MENTOR',
      403,
      'STAFF',
      'Project lead access required.',
    );
  if (a.role === 'STUDENT') {
    ensure(
      !pod.archivedAt && pod.project.status === 'PUBLISHED',
      403,
      'ARCHIVED',
      'This project workspace is archived or not published.',
    );
    const m = await db.podMember.findUnique({
      where: { podId_userId: { podId: id, userId: a.id } },
    });
    ensure(m?.enrollmentId && !m.leftAt, 404, 'POD', 'Pod not found.');
    await studentAccess(a.id, m.enrollmentId, db);
  }
  return pod;
}
export async function eligibleMember(
  a: Actor,
  podId: string,
  userId: string,
  enrollmentId: string,
  supervisorId: string,
  db: Tx,
) {
  const pod = await podAccess(a, podId, db, true),
    e = await studentAccess(userId, enrollmentId, db);
  if (a.role === 'MENTOR') await cohortAccess(a, e.cohortId, db);
  const supervisor = await db.projectStaff.findFirst({
    where: {
      projectId: pod.projectId!,
      userId: supervisorId,
      user: { role: 'MENTOR' },
    },
  });
  ensure(supervisor, 422, 'SUPERVISOR', 'Select an assigned project mentor.');
  await cohortAccess({ id: supervisorId, role: 'MENTOR' }, e.cohortId, db);
  return e;
}
export const transitions: Record<string, readonly string[]> = {
  BACKLOG: ['READY'],
  READY: ['BACKLOG', 'IN_PROGRESS'],
  IN_PROGRESS: ['READY', 'IN_REVIEW'],
  IN_REVIEW: ['IN_PROGRESS', 'QA_TESTING'],
  QA_TESTING: ['IN_PROGRESS', 'DONE'],
  DONE: [],
};
export function allowedTransition(from: string, to: string, student: boolean) {
  return (
    !!transitions[from]?.includes(to) &&
    (!student ||
      (from === 'READY' && to === 'IN_PROGRESS') ||
      (from === 'IN_PROGRESS' && to === 'IN_REVIEW'))
  );
}
