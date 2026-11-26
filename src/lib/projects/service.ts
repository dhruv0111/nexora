import { githubLink } from './github';
import 'server-only';
import { z } from 'zod';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { cohortAccess } from '@/lib/learning/policy';
import { httpsUrl } from '@/lib/learning/content';
import {
  projectAccess,
  podAccess,
  eligibleMember,
  allowedTransition,
} from './policy';
export const id = z.string().min(1).max(100);
const label = z.string().trim().min(3).max(160),
  body = z.string().trim().min(10).max(10000);
export async function createProject(a: Actor, input: unknown) {
  const b = z
    .object({
      title: label,
      brief: body,
      productKey: z.string().regex(/^[a-z0-9-]{3,60}$/),
      courseId: z.string().max(100),
      technologies: z.array(label).max(20),
      confidential: z.boolean(),
      mentorId: id,
      status: z.enum(['DRAFT', 'PUBLISHED']),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    ensure(
      (
        await tx.user.findUnique({
          where: { id: a.id },
          select: { role: true },
        })
      )?.role === a.role,
      403,
      'ROLE',
      'Current staff authorization required.',
    );
    ensure(
      ['ADMIN', 'MENTOR'].includes(a.role),
      403,
      'STAFF',
      'Project lead access required.',
    );
    if (a.role === 'MENTOR') {
      ensure(
        b.mentorId === a.id && b.courseId,
        403,
        'SCOPE',
        'Mentors may create projects only for their assigned courses.',
      );
      const c = await tx.cohort.findFirst({
        where: {
          courseId: b.courseId,
          mentors: {
            some: { mentor: { userId: a.id, user: { role: 'MENTOR' } } },
          },
        },
      });
      ensure(c, 404, 'COHORT', 'Assigned course not found.');
      await cohortAccess(a, c.id, tx);
    }
    ensure(
      (await tx.user.count({ where: { id: b.mentorId, role: 'MENTOR' } })) ===
        1,
      422,
      'MENTOR',
      'Choose an existing mentor account.',
    );
    if (b.courseId)
      ensure(
        (await tx.course.count({ where: { id: b.courseId } })) === 1,
        422,
        'COURSE',
        'Course not found.',
      );
    const p = await tx.project.create({
      data: {
        title: b.title,
        brief: b.brief,
        productKey: b.productKey,
        technologies: b.technologies,
        confidential: b.confidential,
        status: b.status,
        courseId: b.courseId || null,
        staff: { create: { userId: b.mentorId } },
      },
    });
    await audit(tx, a.id, 'PROJECT_CREATED', 'Project', p.id, {
      productKey: p.productKey,
      engagementType: p.engagementType,
      confidential: p.confidential,
    });
    return { id: p.id };
  });
}
export async function projectStaff(a: Actor, input: unknown) {
  const b = z
    .object({ projectId: id, userId: id, remove: z.boolean() })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    ensure(a.role === 'ADMIN', 403, 'ADMIN', 'Administrator access required.');
    await projectAccess(a, b.projectId, tx);
    ensure(
      (await tx.user.count({ where: { id: b.userId, role: 'MENTOR' } })) === 1,
      422,
      'MENTOR',
      'Mentor account required.',
    );
    if (b.remove)
      await tx.projectStaff.deleteMany({
        where: { projectId: b.projectId, userId: b.userId },
      });
    else
      await tx.projectStaff.upsert({
        where: {
          projectId_userId: { projectId: b.projectId, userId: b.userId },
        },
        create: { projectId: b.projectId, userId: b.userId },
        update: {},
      });
    await audit(tx, a.id, 'PROJECT_STAFF_CHANGED', 'Project', b.projectId, {
      userId: b.userId,
      removed: b.remove,
    });
    return { saved: true };
  });
}
export async function createPod(a: Actor, input: unknown) {
  const b = z.object({ projectId: id, name: label }).strict().parse(input);
  return serial(async (tx) => {
    await projectAccess(a, b.projectId, tx);
    ensure(a.role !== 'STUDENT', 403, 'STAFF', 'Project lead access required.');
    const p = await tx.agilePod.create({
      data: { projectId: b.projectId, name: b.name },
    });
    await audit(tx, a.id, 'POD_CREATED', 'AgilePod', p.id, {
      projectId: b.projectId,
    });
    return { id: p.id };
  });
}
export async function membership(a: Actor, input: unknown) {
  const b = z
    .object({
      podId: id,
      userId: id,
      enrollmentId: id,
      supervisorId: id,
      responsibility: body,
      remove: z.boolean(),
      version: z.number().int().nonnegative(),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `pod:${b.podId}`);
    await podAccess(a, b.podId, tx, true);
    const old = await tx.podMember.findUnique({
      where: { podId_userId: { podId: b.podId, userId: b.userId } },
    });
    ensure(
      (old?.version ?? 0) === b.version,
      409,
      'VERSION',
      'Membership changed. Refresh.',
    );
    if (b.remove) {
      ensure(old && !old.leftAt, 404, 'MEMBER', 'Active membership not found.');
      await tx.podMember.update({
        where: { podId_userId: { podId: b.podId, userId: b.userId } },
        data: { leftAt: new Date(), version: { increment: 1 } },
      });
    } else {
      ensure(
        !old?.leftAt,
        409,
        'HISTORY',
        'Create a new pod engagement rather than overwriting ended participation dates.',
      );
      const e = await eligibleMember(
        a,
        b.podId,
        b.userId,
        b.enrollmentId,
        b.supervisorId,
        tx,
      );
      const data = {
        enrollmentId: e.id,
        supervisorId: b.supervisorId,
        responsibility: b.responsibility,
        discipline: e.cohort.course.track,
      };
      await tx.podMember.upsert({
        where: { podId_userId: { podId: b.podId, userId: b.userId } },
        create: { podId: b.podId, userId: b.userId, ...data },
        update: { ...data, version: { increment: 1 } },
      });
    }
    await audit(tx, a.id, 'POD_MEMBERSHIP_CHANGED', 'AgilePod', b.podId, {
      userId: b.userId,
      removed: b.remove,
    });
    return { saved: true };
  });
}
export async function sprint(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      podId: id,
      version: z.number().int().nonnegative(),
      name: label,
      goal: body,
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
      retrospective: z.string().trim().max(10000),
    })
    .strict()
    .parse(input);
  ensure(
    new Date(b.endsAt) > new Date(b.startsAt),
    422,
    'DATES',
    'Sprint end must follow start.',
  );
  return serial(async (tx) => {
    await lock(tx, `pod:${b.podId}`);
    await podAccess(a, b.podId, tx, true);
    const old = b.id
      ? await tx.projectSprint.findFirst({
          where: { id: b.id, podId: b.podId },
        })
      : null;
    ensure(
      b.id ? old?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Sprint changed.',
    );
    ensure(
      old
        ? (
            {
              PLANNED: ['PLANNED', 'ACTIVE', 'CANCELLED'],
              ACTIVE: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
              COMPLETED: [],
              CANCELLED: [],
            } as Record<string, string[]>
          )[old.status]?.includes(b.status)
        : b.status === 'PLANNED',
      409,
      'SPRINT_FLOW',
      'Invalid sprint lifecycle transition.',
    );
    if (b.status === 'ACTIVE')
      ensure(
        (await tx.projectSprint.count({
          where: {
            podId: b.podId,
            status: 'ACTIVE',
            ...(b.id ? { id: { not: b.id } } : {}),
          },
        })) === 0,
        409,
        'ACTIVE_SPRINT',
        'Only one sprint may be active.',
      );
    if (b.status === 'COMPLETED')
      ensure(
        b.retrospective.length >= 20,
        422,
        'RETROSPECTIVE',
        'Record the sprint outcomes and retrospective.',
      );
    const data = {
      podId: b.podId,
      name: b.name,
      goal: b.goal,
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      status: b.status,
      retrospective: b.retrospective,
    };
    const s = old
      ? await tx.projectSprint.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.projectSprint.create({ data });
    await audit(tx, a.id, 'SPRINT_CHANGED', 'ProjectSprint', s.id, {
      status: s.status,
      version: s.version,
    });
    return { id: s.id };
  });
}
export async function saveTicket(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version: z.number().int().nonnegative(),
      podId: id,
      sprintId: z.string().max(100),
      assigneeId: z.string().max(100),
      title: label,
      requirements: body,
      acceptance: z.array(label).min(1).max(20),
      definitionOfDone: z.array(label).min(1).max(20),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      kind: z.enum(['STORY', 'TASK', 'DEFECT']),
      dueAt: z.iso.datetime(),
      issueUrl: httpsUrl,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await podAccess(a, b.podId, tx, true);
    if (b.issueUrl) {
      const link = githubLink(b.issueUrl);
      const pod = await tx.agilePod.findUniqueOrThrow({
        where: { id: b.podId },
      });
      ensure(
        link.kind === 'issues' &&
          (await tx.projectRepository.count({
            where: { projectId: pod.projectId!, fullName: link.repository },
          })) === 1,
        422,
        'REPOSITORY',
        'Issue must belong to an authorized project repository.',
      );
    }
    await lock(tx, `pod:${b.podId}`);
    const old = b.id
      ? await tx.projectTicket.findFirst({
          where: { id: b.id, podId: b.podId },
        })
      : null;
    ensure(
      b.id ? old?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Ticket changed.',
    );
    ensure(
      !old || ['BACKLOG', 'READY', 'IN_PROGRESS'].includes(old.status),
      409,
      'REVIEW_LOCK',
      'Return the ticket to development before changing reviewed work.',
    );
    if (b.sprintId)
      ensure(
        (await tx.projectSprint.count({
          where: {
            id: b.sprintId,
            podId: b.podId,
            status: { in: ['PLANNED', 'ACTIVE'] },
          },
        })) === 1,
        422,
        'SPRINT',
        'Choose an open sprint in this pod.',
      );
    if (b.assigneeId) {
      const m = await tx.podMember.findUnique({
        where: { podId_userId: { podId: b.podId, userId: b.assigneeId } },
      });
      ensure(
        m?.enrollmentId && !m.leftAt,
        422,
        'ASSIGNEE',
        'Choose an active pod member.',
      );
      await podAccess({ id: b.assigneeId, role: 'STUDENT' }, b.podId, tx);
    }
    const data = {
      podId: b.podId,
      sprintId: b.sprintId || null,
      assigneeId: b.assigneeId || null,
      title: b.title,
      requirements: b.requirements,
      acceptance: b.acceptance,
      definitionOfDone: b.definitionOfDone,
      priority: b.priority,
      kind: b.kind,
      dueAt: new Date(b.dueAt),
      issueUrl: b.issueUrl || null,
      codeReviewed: false,
      qaAccepted: false,
      dodAccepted: false,
      securityCleared: false,
    };
    if (!old)
      ensure(
        (await tx.projectTicket.count({ where: { podId: b.podId } })) < 500,
        409,
        'TICKET_LIMIT',
        'A pod supports up to 500 tickets.',
      );
    const t = old
      ? await tx.projectTicket.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.projectTicket.create({ data });
    if (old) {
      await tx.contributionEvidence.updateMany({
        where: { ticketId: old.id, status: { in: ['SUBMITTED', 'APPROVED'] } },
        data: {
          status: 'CHANGES_REQUESTED',
          feedback: 'Ticket requirements changed; a fresh review is required.',
        },
      });
      await tx.portfolioEntry.updateMany({
        where: { evidence: { ticketId: old.id } },
        data: { status: 'DRAFT', approvedAt: null },
      });
    }
    await audit(tx, a.id, 'PROJECT_TICKET_SAVED', 'ProjectTicket', t.id, {
      version: t.version,
    });
    return { id: t.id };
  });
}
export async function transition(a: Actor, input: unknown) {
  const b = z
    .object({
      ticketId: id,
      version: z.number().int().positive(),
      status: z.enum([
        'BACKLOG',
        'READY',
        'IN_PROGRESS',
        'IN_REVIEW',
        'QA_TESTING',
        'DONE',
      ]),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `ticket:${b.ticketId}`);
    const t = await tx.projectTicket.findUnique({
      where: { id: b.ticketId },
      include: { sprint: true },
    });
    ensure(t, 404, 'TICKET', 'Ticket not found.');
    await podAccess(a, t.podId, tx);
    ensure(t.version === b.version, 409, 'VERSION', 'Ticket changed. Refresh.');
    ensure(
      a.role !== 'STUDENT' || t.assigneeId === a.id,
      403,
      'ASSIGNEE',
      'Only your assigned ticket can be moved.',
    );
    ensure(
      allowedTransition(t.status, b.status, a.role === 'STUDENT'),
      409,
      'TRANSITION',
      'That status transition is not allowed.',
    );
    if (['IN_PROGRESS', 'IN_REVIEW', 'QA_TESTING', 'DONE'].includes(b.status))
      ensure(
        t.assigneeId && t.sprint?.status === 'ACTIVE',
        409,
        'SPRINT',
        'An assigned ticket in an active sprint is required.',
      );
    if (b.status === 'QA_TESTING')
      ensure(t.codeReviewed, 409, 'REVIEW_GATE', 'Lead review is required.');
    if (b.status === 'DONE') {
      ensure(
        t.codeReviewed && t.qaAccepted && t.dodAccepted && t.securityCleared,
        409,
        'QUALITY_GATE',
        'Review, QA, security and Definition of Done gates must pass.',
      );
      ensure(
        (await tx.contributionEvidence.count({
          where: { ticketId: t.id, userId: t.assigneeId!, status: 'APPROVED' },
        })) > 0,
        409,
        'EVIDENCE_GATE',
        'An approved contribution from the assignee is required.',
      );
      ensure(
        (await tx.projectConcern.count({
          where: { podId: t.podId, resolvedAt: null, kind: 'SECURITY' },
        })) === 0,
        409,
        'SECURITY_GATE',
        'Resolve pod security concerns first.',
      );
    }
    const changed = await tx.projectTicket.update({
      where: { id: t.id },
      data: {
        status: b.status,
        version: { increment: 1 },
        ...(b.status === 'IN_PROGRESS'
          ? {
              codeReviewed: false,
              qaAccepted: false,
              dodAccepted: false,
              securityCleared: false,
            }
          : {}),
      },
    });
    await audit(tx, a.id, 'PROJECT_TICKET_MOVED', 'ProjectTicket', t.id, {
      from: t.status,
      to: b.status,
      version: changed.version,
    });
    return { id: t.id, status: changed.status };
  });
}
export async function quality(a: Actor, input: unknown) {
  const b = z
    .object({
      ticketId: id,
      version: z.number().int().positive(),
      codeReviewed: z.boolean(),
      qaAccepted: z.boolean(),
      dodAccepted: z.boolean(),
      securityCleared: z.boolean(),
      note: body,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const t = await tx.projectTicket.findUnique({ where: { id: b.ticketId } });
    ensure(t, 404, 'TICKET', 'Ticket not found.');
    await podAccess(a, t.podId, tx, true);
    ensure(
      t.version === b.version && ['IN_REVIEW', 'QA_TESTING'].includes(t.status),
      409,
      'VERSION',
      'Only the current review/QA revision can receive sign-off.',
    );
    const updated = await tx.projectTicket.update({
      where: { id: t.id },
      data: {
        codeReviewed: b.codeReviewed,
        qaAccepted: b.qaAccepted,
        dodAccepted: b.dodAccepted,
        securityCleared: b.securityCleared,
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'PROJECT_QUALITY_REVIEW', 'ProjectTicket', t.id, {
      codeReviewed: b.codeReviewed,
      qaAccepted: b.qaAccepted,
      dodAccepted: b.dodAccepted,
      securityCleared: b.securityCleared,
      note: b.note,
    });
    return { id: updated.id };
  });
}

export async function saveProject(a: Actor, input: unknown) {
  const b = z
    .object({
      id,
      version: z.number().int().positive(),
      title: label,
      brief: body,
      technologies: z.array(label).max(20),
      confidential: z.boolean(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
      publicationNote: body,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `project:${b.id}`);
    const p = await projectAccess(a, b.id, tx);
    ensure(
      a.role === 'ADMIN' || a.role === 'MENTOR',
      403,
      'STAFF',
      'Project lead access required.',
    );
    ensure(
      p.version === b.version,
      409,
      'VERSION',
      'Project changed. Refresh before saving.',
    );
    ensure(
      a.role === 'ADMIN' ||
        (p.confidential === b.confidential && p.status !== 'ARCHIVED'),
      403,
      'PUBLICATION',
      'Only an administrator can change confidentiality or reopen an archived project.',
    );
    if (b.status === 'PUBLISHED')
      ensure(
        (await tx.projectStaff.count({
          where: { projectId: p.id, user: { role: 'MENTOR' } },
        })) > 0,
        409,
        'SUPERVISOR',
        'Assign an active project mentor before publication.',
      );
    const updated = await tx.project.update({
      where: { id: p.id },
      data: {
        title: b.title,
        brief: b.brief,
        technologies: b.technologies,
        confidential: b.confidential,
        status: b.status,
        version: { increment: 1 },
      },
    });
    await tx.portfolioEntry.updateMany({
      where: { evidence: { ticket: { pod: { projectId: p.id } } } },
      data: { status: 'DRAFT', approvedAt: null },
    });
    await audit(tx, a.id, 'PROJECT_UPDATED', 'Project', p.id, {
      version: updated.version,
      status: updated.status,
      publicationNote: b.publicationNote,
      previous: JSON.parse(JSON.stringify(p)),
    });
    return { id: p.id, version: updated.version };
  });
}
