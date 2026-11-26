import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/domain/http';
import { podAccess } from './policy';
import { paidWhere } from '@/lib/learning/policy';
export async function projectsFor(a: Actor) {
  const member = {
    userId: a.id,
    leftAt: null,
    enrollment: {
      ...paidWhere,
      cohort: {
        status: 'PUBLISHED' as const,
        course: {
          status: 'PUBLISHED' as const,
          contentApprovedAt: { not: null },
        },
      },
    },
  };
  return getDb().project.findMany({
    where:
      a.role === 'ADMIN'
        ? {}
        : a.role === 'MENTOR'
          ? { staff: { some: { userId: a.id } } }
          : {
              status: 'PUBLISHED',
              pods: { some: { archivedAt: null, members: { some: member } } },
            },
    include: {
      pods: {
        where:
          a.role === 'STUDENT'
            ? { archivedAt: null, members: { some: member } }
            : {},
        select: { id: true, name: true, archivedAt: true },
        take: 50,
      },
      staff: {
        select: { userId: true, user: { select: { name: true } } },
        take: 20,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
}
export async function podBoard(
  a: Actor,
  podId: string,
  query: Record<string, string | undefined>,
) {
  const p = await podAccess(a, podId),
    db = getDb(),
    page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const where = {
    podId,
    ...(query.mine === 'yes' ? { assigneeId: a.id } : {}),
    ...(query.q
      ? {
          title: {
            contains: query.q.slice(0, 100),
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...([
      'BACKLOG',
      'READY',
      'IN_PROGRESS',
      'IN_REVIEW',
      'QA_TESTING',
      'DONE',
    ].includes(query.status ?? '')
      ? { status: query.status }
      : {}),
    ...(query.sprint ? { sprintId: query.sprint } : {}),
  };
  const [tickets, members, sprints, concerns, releases, history] =
    await Promise.all([
      db.projectTicket.findMany({
        where,
        include: {
          assignee: { select: { name: true } },
          _count: { select: { evidence: { where: { status: 'APPROVED' } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * 24,
        take: 24,
      }),
      db.podMember.findMany({
        where: { podId },
        include: { user: { select: { name: true } } },
        orderBy: { joinedAt: 'asc' },
        take: 100,
      }),
      db.projectSprint.findMany({
        where: { podId },
        orderBy: { startsAt: 'desc' },
        take: 30,
      }),
      db.projectConcern.findMany({
        where: { podId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.projectRelease.findMany({
        where: { podId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.auditLog.findMany({
        where: {
          OR: [
            { entityId: podId },
            {
              entityId: {
                in: (
                  await db.projectTicket.findMany({
                    where: { podId },
                    select: { id: true },
                    take: 500,
                  })
                ).map((t) => t.id),
              },
            },
          ],
        },
        select: { id: true, action: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
  return { p, tickets, members, sprints, concerns, releases, history, page };
}
export async function ticketRead(a: Actor, id: string) {
  const db = getDb();
  const t = await db.projectTicket.findUnique({
    where: { id },
    include: { assignee: { select: { name: true } }, sprint: true },
  });
  if (!t) {
    const { DomainError } = await import('@/lib/domain/errors');
    throw new DomainError(404, 'TICKET', 'Ticket not found.');
  }
  const p = await podAccess(a, t.podId);
  const [evidence, comments, portfolios] = await Promise.all([
    db.contributionEvidence.findMany({
      where: { ticketId: id },
      include: {
        user: { select: { name: true } },
        files: {
          where: { removedAt: null },
          select: { id: true, name: true, size: true },
          take: 3,
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 30,
    }),
    db.projectComment.findMany({
      where: { ticketId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.portfolioEntry.findMany({
      where: { evidence: { ticketId: id } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);
  return { t, p, evidence, comments, portfolios };
}
