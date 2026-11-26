import 'server-only';
import { z } from 'zod';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import {
  id,
  label,
  text,
  short,
  version,
  https,
  current,
  role,
  staffStudent,
  applicationAccess,
  consentAccess,
} from './policy';
const timezone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Use an IANA timezone.');
export async function interview(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      applicationId: id,
      version,
      action: z.enum([
        'REQUEST',
        'CONFIRM',
        'AVAILABILITY',
        'RESCHEDULE',
        'CANCEL',
        'COMPLETE',
      ]),
      round: label,
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      timezone,
      availability: short,
      meetingUrl: z.union([z.literal(''), https]),
      feedback: short,
      privateFeedback: short,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `hiring:${b.applicationId}`);
    const app = await applicationAccess(a, b.applicationId, tx);
    const old = b.id
      ? await tx.hiringInterview.findUnique({ where: { id: b.id } })
      : null;
    ensure(
      !b.id || old?.applicationId === app.id,
      404,
      'INTERVIEW',
      'Interview not found.',
    );
    current(old?.version ?? 0, b.version);
    ensure(
      !['DRAFT', 'REJECTED', 'WITHDRAWN', 'CLOSED', 'HIRED'].includes(
        app.status,
      ),
      409,
      'APPLICATION_CLOSED',
      'Application is not active.',
    );
    let data;
    if (a.role === 'STUDENT') {
      ensure(
        old &&
          ['CONFIRM', 'AVAILABILITY', 'CANCEL'].includes(b.action) &&
          ['REQUESTED', 'CONFIRMED'].includes(old.status),
        403,
        'INTERVIEW',
        'Candidates can confirm, provide availability or cancel an invitation.',
      );
      if (b.action === 'CONFIRM')
        ensure(
          old.startsAt > new Date(),
          409,
          'PAST',
          'This interview has already started.',
        );
      data = {
        availability: b.availability,
        status:
          b.action === 'CONFIRM'
            ? 'CONFIRMED'
            : b.action === 'CANCEL'
              ? 'CANCELLED'
              : old.status,
      };
    } else {
      if (a.role === 'EMPLOYER') await consentAccess(a, app.userId, tx);
      ensure(
        ['REQUEST', 'RESCHEDULE', 'CANCEL', 'COMPLETE'].includes(b.action),
        403,
        'INTERVIEW',
        'Unsupported recruiter action.',
      );
      ensure(
        ['SHORTLISTED', 'INTERVIEW'].includes(app.status),
        409,
        'STAGE',
        'Shortlist the candidate before scheduling.',
      );
      if (b.action === 'REQUEST' || b.action === 'RESCHEDULE') {
        ensure(
          (b.action === 'REQUEST' && !old) ||
            (b.action === 'RESCHEDULE' && old && old.status !== 'COMPLETED'),
          409,
          'INTERVIEW',
          'Invalid scheduling action.',
        );
        const startsAt = new Date(b.startsAt),
          endsAt = new Date(b.endsAt);
        ensure(
          startsAt > new Date() &&
            endsAt > startsAt &&
            +endsAt - +startsAt <= 4 * 3600000,
          422,
          'TIME',
          'Choose a future interview lasting up to four hours.',
        );
        const conflict = await tx.hiringInterview.count({
          where: {
            id: { not: old?.id ?? '' },
            status: { in: ['REQUESTED', 'CONFIRMED'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            application: {
              OR: [
                { userId: app.userId },
                { opportunity: { employerId: app.opportunity.employerId } },
              ],
            },
          },
        });
        ensure(
          !conflict,
          409,
          'CONFLICT',
          'Candidate or recruiter already has an interview at this time.',
        );
        data = {
          round: b.round,
          startsAt,
          endsAt,
          timezone: b.timezone,
          meetingUrl: b.meetingUrl,
          status: 'REQUESTED',
          feedback: '',
          privateFeedback: '',
        };
      } else {
        ensure(
          old && ['REQUESTED', 'CONFIRMED'].includes(old.status),
          409,
          'INTERVIEW',
          'No active invitation.',
        );
        if (b.action === 'COMPLETE')
          ensure(
            old.endsAt <= new Date() && b.feedback.length >= 10,
            422,
            'FEEDBACK',
            'Record candidate feedback after the interview ends.',
          );
        data = {
          status: b.action === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED',
          feedback: b.feedback,
          privateFeedback: b.privateFeedback,
        };
      }
    }
    const r = old
      ? await tx.hiringInterview.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.hiringInterview.create({
          data: {
            applicationId: app.id,
            round: b.round,
            startsAt: new Date(b.startsAt),
            endsAt: new Date(b.endsAt),
            timezone: b.timezone,
            ...data,
          },
        });
    await audit(tx, a.id, `INTERVIEW_${b.action}`, 'HiringInterview', r.id, {
      applicationId: app.id,
      version: r.version,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    });
    await tx.learningNotification.create({
      data: {
        userId:
          a.role === 'STUDENT' ? app.opportunity.employer.userId : app.userId,
        title: {
          REQUEST: 'Interview invitation',
          CONFIRM: 'Interview confirmed',
          AVAILABILITY: 'Interview availability updated',
          RESCHEDULE: 'Interview schedule updated',
          CANCEL: 'Interview cancelled',
          COMPLETE: 'Interview feedback available',
        }[b.action],
        href: `/career/applications/${app.id}`,
      },
    });
    return { id: r.id };
  });
}
export async function mockInterview(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      userId: id,
      mentorId: id,
      version,
      status: z.enum(['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      availability: short,
      feedback: short,
      score: z.number().int().min(-1).max(100),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['STUDENT', 'MENTOR', 'ADMIN'], tx);
    await lock(tx, `career:${b.userId}`);
    if (a.role === 'STUDENT')
      ensure(b.userId === a.id, 404, 'MOCK', 'Mock interview not found.');
    else await staffStudent(a, b.userId, tx);
    await staffStudent({ id: b.mentorId, role: 'MENTOR' }, b.userId, tx);
    const old = b.id
      ? await tx.careerMock.findUnique({ where: { id: b.id } })
      : null;
    ensure(
      !b.id || old?.userId === b.userId,
      404,
      'MOCK',
      'Mock interview not found.',
    );
    current(old?.version ?? 0, b.version);
    if (old && a.role === 'MENTOR')
      ensure(
        old.mentorId === a.id,
        403,
        'MOCK',
        'Only the assigned interviewer may update this mock.',
      );
    if (a.role === 'STUDENT')
      ensure(
        (!old && b.status === 'REQUESTED') ||
          (old &&
            ['REQUESTED', 'CONFIRMED'].includes(old.status) &&
            b.status === 'CANCELLED'),
        403,
        'MOCK',
        'Students request or cancel their own mock interview.',
      );
    else
      ensure(
        a.role === 'ADMIN' || b.mentorId === a.id,
        403,
        'MOCK',
        'Assigned interviewer access required.',
      );
    const start = new Date(b.startsAt),
      end = new Date(b.endsAt);
    ensure(
      end > start && +end - +start <= 4 * 3600000,
      422,
      'TIME',
      'Invalid mock interview duration.',
    );
    ensure(
      b.status === 'CANCELLED' ||
        b.status === 'COMPLETED' ||
        start > new Date(),
      422,
      'TIME',
      'Choose a future time.',
    );
    if (b.status === 'COMPLETED')
      ensure(
        old?.status === 'CONFIRMED' &&
          old.endsAt <= new Date() &&
          +start === +old.startsAt &&
          +end === +old.endsAt &&
          b.score >= 0 &&
          b.feedback.length >= 10,
        409,
        'MOCK',
        'Complete only a confirmed past mock with feedback and score.',
      );
    if (b.status === 'CONFIRMED')
      ensure(
        old?.status === 'REQUESTED',
        409,
        'MOCK',
        'Confirm a pending request.',
      );
    if (old)
      ensure(
        !['CANCELLED', 'COMPLETED'].includes(old.status),
        409,
        'MOCK',
        'This mock interview is closed.',
      );
    if (['REQUESTED', 'CONFIRMED'].includes(b.status)) {
      const conflicts = await tx.careerMock.count({
        where: {
          id: { not: old?.id ?? '' },
          OR: [{ userId: b.userId }, { mentorId: b.mentorId }],
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
      });
      ensure(
        !conflicts,
        409,
        'CONFLICT',
        'Student or mentor has another mock interview at this time.',
      );
    }
    const data = {
      userId: b.userId,
      mentorId: b.mentorId,
      startsAt: start,
      endsAt: end,
      status: b.status,
      availability: b.availability,
      feedback: a.role === 'STUDENT' ? '' : b.feedback,
      score: b.status === 'COMPLETED' ? b.score : null,
    };
    if (a.role === 'STUDENT' && old) {
      data.mentorId = old.mentorId;
      data.startsAt = old.startsAt;
      data.endsAt = old.endsAt;
      data.feedback = old.feedback;
      data.score = old.score;
    }
    const r = old
      ? await tx.careerMock.update({
          where: { id: old.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.careerMock.create({ data });
    await audit(tx, a.id, 'MOCK_INTERVIEW_SAVED', 'CareerMock', r.id, {
      status: r.status,
      version: r.version,
    });
    await tx.learningNotification.create({
      data: {
        userId: a.role === 'STUDENT' ? b.mentorId : b.userId,
        title: `Mock interview: ${b.status}`,
        href: '/career',
      },
    });
    return { id: r.id };
  });
}
export async function support(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version,
      subject: label,
      message: text,
      response: short,
      status: z.enum(['OPEN', 'CLOSED']),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['STUDENT', 'ADMIN'], tx);
    if (!b.id) {
      ensure(
        a.role === 'STUDENT' && b.status === 'OPEN',
        403,
        'SUPPORT',
        'Students can open support requests.',
      );
      const r = await tx.careerRequest.create({
        data: { userId: a.id, subject: b.subject, message: b.message },
      });
      await audit(tx, a.id, 'CAREER_SUPPORT_OPENED', 'CareerRequest', r.id);
      return { id: r.id };
    }
    const r = await tx.careerRequest.findUnique({ where: { id: b.id } });
    ensure(
      r && (a.role === 'ADMIN' || r.userId === a.id),
      404,
      'SUPPORT',
      'Support request not found.',
    );
    current(r.version, b.version);
    ensure(
      a.role === 'ADMIN',
      403,
      'SUPPORT',
      'A career administrator must respond.',
    );
    await tx.careerRequest.update({
      where: { id: r.id },
      data: {
        response: b.response,
        status: b.status,
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'CAREER_SUPPORT_UPDATED', 'CareerRequest', r.id, {
      status: b.status,
    });
    return { id: r.id };
  });
}
