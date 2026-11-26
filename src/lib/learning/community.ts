import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { cohortAccess, paidWhere } from './policy';
import { httpsUrl } from './content';
const id = z.string().min(1).max(100);
export async function scheduleClass(actor: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version: z.number().int().nonnegative(),
      cohortId: id,
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(10).max(5000),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      meetingUrl: httpsUrl,
      recordingUrl: httpsUrl,
      status: z.enum(['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED']),
    })
    .strict()
    .parse(input);
  ensure(
    new Date(b.endsAt) > new Date(b.startsAt),
    422,
    'DATES',
    'Class end must follow its start.',
  );
  return serial(async (tx) => {
    await cohortAccess(actor, b.cohortId, tx);
    await lock(tx, `class:${b.id ?? b.cohortId}`);
    const current = b.id
      ? await tx.liveClass.findFirst({
          where: { id: b.id, cohortId: b.cohortId },
        })
      : null;
    ensure(
      b.id ? current?.version === b.version : b.version === 0,
      409,
      'VERSION',
      'Schedule changed. Reload.',
    );
    if (b.status === 'COMPLETED')
      ensure(
        new Date(b.startsAt) <= new Date(),
        422,
        'CLASS_FUTURE',
        'A future class cannot be marked complete.',
      );
    const data = {
      cohortId: b.cohortId,
      title: b.title,
      description: b.description,
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      meetingUrl: b.meetingUrl || null,
      recordingUrl: b.recordingUrl || null,
      status: b.status,
    };
    const c = current
      ? await tx.liveClass.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.liveClass.create({ data });
    const members = await tx.enrollment.findMany({
      where: { cohortId: b.cohortId, ...paidWhere },
      select: { userId: true },
      take: 10000,
    });
    if (members.length)
      await tx.learningNotification.createMany({
        data: members.map((e) => ({
          userId: e.userId,
          title: `Class ${b.status.toLowerCase()}: ${b.title}`,
          href: '/learning/classes',
        })),
      });
    await audit(tx, actor.id, 'CLASS_SCHEDULED', 'LiveClass', c.id, {
      version: c.version,
      status: c.status,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
    });
    return { id: c.id };
  });
}
export async function recordAttendance(actor: Actor, input: unknown) {
  const b = z
    .object({
      classId: id,
      userId: id,
      status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const c = await tx.liveClass.findUnique({ where: { id: b.classId } });
    ensure(c, 404, 'CLASS', 'Class not found.');
    await cohortAccess(actor, c.cohortId, tx);
    ensure(
      c.status !== 'CANCELLED' && c.startsAt <= new Date(),
      409,
      'CLASS_TIME',
      'Attendance requires a class that has started and is not cancelled.',
    );
    const e = await tx.enrollment.findFirst({
      where: { cohortId: c.cohortId, userId: b.userId, ...paidWhere },
    });
    ensure(
      e,
      404,
      'STUDENT',
      'An eligible student in this cohort is required.',
    );
    await tx.attendance.upsert({
      where: { classId_userId: { classId: c.id, userId: b.userId } },
      create: { ...b, recordedBy: actor.id },
      update: { status: b.status, recordedBy: actor.id },
    });
    await audit(tx, actor.id, 'ATTENDANCE_RECORDED', 'LiveClass', c.id, {
      userId: b.userId,
      status: b.status,
    });
    return { saved: true };
  });
}
export async function announce(actor: Actor, input: unknown) {
  const b = z
    .object({
      cohortId: id,
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(10).max(5000),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await cohortAccess(actor, b.cohortId, tx);
    const a = await tx.announcement.create({
      data: { ...b, authorId: actor.id },
    });
    const students = await tx.enrollment.findMany({
      where: { cohortId: b.cohortId, ...paidWhere },
      select: { userId: true },
      take: 10000,
    });
    if (students.length)
      await tx.learningNotification.createMany({
        data: students.map((s) => ({
          userId: s.userId,
          title: b.title,
          href: '/learning/announcements',
        })),
      });
    await audit(tx, actor.id, 'ANNOUNCEMENT_PUBLISHED', 'Announcement', a.id, {
      cohortId: b.cohortId,
    });
    return { id: a.id };
  });
}
export async function openTicket(userId: string, input: unknown) {
  const b = z
    .object({
      requestKey: z.uuid(),
      subject: z.string().trim().min(5).max(160),
      category: z.enum(['TECHNICAL', 'LEARNING', 'BILLING', 'ACCESSIBILITY']),
      priority: z.enum(['NORMAL', 'HIGH']),
      body: z.string().trim().min(10).max(5000),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `ticket:${userId}:${b.requestKey}`);
    // Request key is a separate unique ticket key; retries never create another conversation.
    const prior = await tx.supportTicket.findUnique({
      where: { requestKey: b.requestKey },
    });
    if (prior) {
      ensure(
        prior.userId === userId,
        409,
        'KEY_REUSE',
        'Ticket key already used.',
      );
      return { id: prior.id };
    }
    const t = await tx.supportTicket.create({
      data: {
        requestKey: b.requestKey,
        userId,
        subject: b.subject,
        category: b.category,
        priority: b.priority,
        messages: { create: { authorId: userId, body: b.body } },
      },
    });
    await audit(tx, userId, 'SUPPORT_OPENED', 'SupportTicket', t.id, {
      category: b.category,
      priority: b.priority,
    });
    return { id: t.id };
  });
}
export async function ticketAccess(actor: Actor, ticketId: string) {
  const t = await getDb().supportTicket.findFirst({
    where: {
      id: ticketId,
      ...(actor.role === 'ADMIN' ? {} : { userId: actor.id }),
    },
  });
  ensure(
    t && ['STUDENT', 'ADMIN'].includes(actor.role),
    404,
    'TICKET',
    'Support ticket not found.',
  );
  return t;
}
export async function replyTicket(actor: Actor, input: unknown) {
  const b = z
    .object({
      ticketId: id,
      version: z.number().int().positive(),
      body: z.string().trim().min(2).max(5000),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
      assigneeId: z.union([id, z.literal('')]).optional(),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `ticket:${b.ticketId}`);
    const t = await tx.supportTicket.findFirst({
      where: {
        id: b.ticketId,
        ...(actor.role === 'ADMIN' ? {} : { userId: actor.id }),
      },
    });
    ensure(
      t && ['ADMIN', 'STUDENT'].includes(actor.role),
      404,
      'TICKET',
      'Support ticket not found.',
    );
    ensure(
      t.version === b.version,
      409,
      'VERSION',
      'Conversation changed. Reload before replying.',
    );
    if (actor.role === 'STUDENT')
      ensure(
        b.status === 'OPEN' && !b.assigneeId,
        403,
        'STAFF',
        'Only support administrators can assign or resolve tickets.',
      );
    if (b.assigneeId)
      ensure(
        (await tx.user.count({
          where: { id: b.assigneeId, role: 'ADMIN' },
        })) === 1,
        422,
        'ASSIGNEE',
        'Assign tickets only to a support administrator.',
      );
    await tx.supportMessage.create({
      data: { ticketId: t.id, authorId: actor.id, body: b.body },
    });
    await tx.supportTicket.update({
      where: { id: t.id },
      data: {
        status: b.status,
        version: { increment: 1 },
        ...(actor.role === 'ADMIN' && b.assigneeId !== undefined
          ? { assigneeId: b.assigneeId || null }
          : {}),
      },
    });
    if (actor.role === 'ADMIN')
      await tx.learningNotification.create({
        data: {
          userId: t.userId,
          title: `Support update: ${t.subject}`,
          href: `/learning/support?ticket=${t.id}`,
        },
      });
    await audit(tx, actor.id, 'SUPPORT_REPLIED', 'SupportTicket', t.id, {
      status: b.status,
    });
    return { id: t.id };
  });
}
export async function readNotification(userId: string, input: unknown) {
  const b = z.object({ id }).strict().parse(input);
  const n = await getDb().learningNotification.updateMany({
    where: { id: b.id, userId },
    data: { readAt: new Date() },
  });
  ensure(n.count, 404, 'NOTIFICATION', 'Notification not found.');
  return { saved: true };
}
