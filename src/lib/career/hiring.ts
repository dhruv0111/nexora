import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { serial, lock, audit } from '@/lib/domain/transaction';
import type { Tx } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import {
  id,
  label,
  text,
  tags,
  version,
  https,
  role,
  current,
  company,
  eligible,
  applicationAccess,
  consentAccess,
  hiringTransitions,
} from './policy';
async function notify(tx: Tx, userId: string, title: string, href: string) {
  await tx.learningNotification.create({ data: { userId, title, href } });
}
export async function registerEmployer(a: Actor, input: unknown) {
  const b = z
    .object({
      companyName: label,
      website: https,
      businessEmail: z.email().max(200),
      recruiterName: label,
      industry: label,
      location: label,
      requirements: text,
      confirmEmployer: z.literal(true),
    })
    .strict()
    .parse(input);
  const domain = new URL(b.website).hostname.replace(/^www\./, '');
  ensure(
    b.businessEmail.split('@')[1].toLowerCase() === domain,
    422,
    'DOMAIN',
    'Use a business email matching the official website domain. Administrative verification is still required.',
  );
  return serial(async (tx) => {
    await role(a, ['EMPLOYER', 'STUDENT'], tx);
    await lock(tx, `employer:${a.id}`);
    ensure(
      !(await tx.employer.findUnique({ where: { userId: a.id } })),
      409,
      'DUPLICATE',
      'Company registration already exists.',
    );
    if (a.role === 'STUDENT') {
      ensure(
        !(await tx.enrollment.count({ where: { userId: a.id } })) &&
          !(await tx.application.count({ where: { userId: a.id } })) &&
          !(await tx.careerProfile.count({ where: { userId: a.id } })),
        409,
        'ACCOUNT',
        'Use a separate recruiter account; existing learner accounts retain their student role.',
      );
      await tx.user.update({ where: { id: a.id }, data: { role: 'EMPLOYER' } });
    }
    const { confirmEmployer: _, ...data } = b;
    void _;
    const e = await tx.employer.create({ data: { ...data, userId: a.id } });
    await audit(tx, a.id, 'EMPLOYER_REGISTERED', 'Employer', e.id, {
      status: 'REGISTERED',
    });
    return { id: e.id };
  });
}
export async function employerReview(a: Actor, input: unknown) {
  const b = z
    .object({
      employerId: id,
      version,
      status: z.enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
      note: text,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `employer:${b.employerId}`);
    const e = await tx.employer.findUnique({ where: { id: b.employerId } });
    ensure(e, 404, 'COMPANY', 'Company not found.');
    if (a.role === 'EMPLOYER') {
      await company(a, tx, false);
      ensure(
        e.userId === a.id &&
          b.status === 'PENDING_REVIEW' &&
          ['REGISTERED', 'REJECTED'].includes(e.verificationStatus),
        403,
        'REVIEW',
        'Only submit your own registration for review.',
      );
    } else await role(a, ['ADMIN'], tx);
    current(e.version, b.version);
    const allowed: Record<string, string[]> = {
      REGISTERED: ['PENDING_REVIEW'],
      PENDING_REVIEW: ['VERIFIED', 'REJECTED'],
      VERIFIED: ['SUSPENDED'],
      REJECTED: ['PENDING_REVIEW'],
      SUSPENDED: ['PENDING_REVIEW'],
    };
    ensure(
      allowed[e.verificationStatus]?.includes(b.status),
      409,
      'TRANSITION',
      'Invalid employer review transition.',
    );
    const r = await tx.employer.update({
      where: { id: e.id },
      data: {
        verificationStatus: b.status,
        verifiedAt: b.status === 'VERIFIED' ? new Date() : null,
        reviewedBy: a.role === 'ADMIN' ? a.id : null,
        reviewNote: b.note,
        version: { increment: 1 },
      },
    });
    if (b.status !== 'VERIFIED')
      await tx.opportunity.updateMany({
        where: { employerId: e.id, status: 'PUBLISHED' },
        data: {
          status: 'DRAFT',
          moderation: 'PENDING',
          version: { increment: 1 },
        },
      });
    await audit(tx, a.id, 'EMPLOYER_REVIEWED', 'Employer', e.id, {
      from: e.verificationStatus,
      to: b.status,
      note: b.note,
    });
    return { id: r.id };
  });
}
export async function saveJob(a: Actor, input: unknown) {
  const b = z
    .object({
      id: id.optional(),
      version,
      title: label,
      description: text,
      skills: tags,
      employmentType: z.enum([
        'FULL_TIME',
        'PART_TIME',
        'CONTRACT',
        'INTERNSHIP',
      ]),
      location: label,
      workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
      eligibility: label,
      minExperience: z.number().int().min(0).max(60),
      compensationMin: z.number().int().min(0).max(1000000000),
      compensationMax: z.number().int().min(0).max(1000000000),
      currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
      deadline: z.iso.datetime(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    })
    .strict()
    .parse(input);
  ensure(
    new Date(b.deadline) > new Date() || b.status !== 'PUBLISHED',
    422,
    'DEADLINE',
    'Choose a future application deadline.',
  );
  ensure(
    b.compensationMax >= b.compensationMin,
    422,
    'COMPENSATION',
    'Maximum compensation must cover the minimum.',
  );
  return serial(async (tx) => {
    const e = await company(a, tx);
    await lock(tx, `jobs:${e.id}`);
    const old = b.id
      ? await tx.opportunity.findUnique({ where: { id: b.id } })
      : null;
    ensure(!b.id || old?.employerId === e.id, 404, 'JOB', 'Opening not found.');
    current(old?.version ?? 0, b.version);
    const duplicateKey = createHash('sha256')
      .update(
        [
          e.id,
          b.title.toLowerCase().replace(/\s+/g, ' '),
          b.location.toLowerCase(),
          b.workMode,
          b.employmentType,
        ].join('|'),
      )
      .digest('hex');
    const changed =
      !old ||
      [
        'title',
        'description',
        'location',
        'workMode',
        'eligibility',
        'minExperience',
        'employmentType',
        'compensationMin',
        'compensationMax',
        'currency',
      ].some(
        (k) =>
          String(old[k as keyof typeof old] ?? '') !==
          String(b[k as keyof typeof b] ?? ''),
      ) ||
      JSON.stringify(old.skills) !== JSON.stringify(b.skills) ||
      old.deadline?.toISOString() !== b.deadline;
    ensure(
      b.status !== 'PUBLISHED' || (old?.moderation === 'APPROVED' && !changed),
      409,
      'MODERATION',
      'Save the draft and obtain admin approval before publication. Editing approved content requires a new review.',
    );
    const { id: jobId, version: _, ...data } = b;
    void jobId;
    void _;
    const j = await tx.opportunity.upsert({
      where: { id: b.id ?? '__new__' },
      create: {
        ...data,
        employerId: e.id,
        duplicateKey,
        deadline: new Date(b.deadline),
      },
      update: {
        ...data,
        deadline: new Date(b.deadline),
        duplicateKey,
        moderation: changed ? 'PENDING' : old?.moderation,
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'JOB_SAVED', 'Opportunity', j.id, {
      version: j.version,
      status: j.status,
      moderation: j.moderation,
    });
    return { id: j.id };
  });
}
export async function moderateJob(a: Actor, input: unknown) {
  const b = z
    .object({
      id,
      version,
      decision: z.enum(['APPROVED', 'REJECTED']),
      note: text,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['ADMIN'], tx);
    const j = await tx.opportunity.findUnique({ where: { id: b.id } });
    ensure(j, 404, 'JOB', 'Opening not found.');
    await lock(tx, `jobs:${j.employerId}`);
    current(j.version, b.version);
    ensure(
      j.status !== 'ARCHIVED',
      409,
      'ARCHIVED',
      'Archived openings cannot be approved.',
    );
    const r = await tx.opportunity.update({
      where: { id: j.id },
      data: {
        moderation: b.decision,
        moderationNote: b.note,
        moderatedBy: a.id,
        status: 'DRAFT',
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'JOB_MODERATED', 'Opportunity', j.id, {
      decision: b.decision,
      note: b.note,
    });
    return { id: r.id };
  });
}
export async function applyJob(a: Actor, input: unknown) {
  const b = z
    .object({
      opportunityId: id,
      statement: text,
      submit: z.boolean(),
      shareConsent: z.boolean(),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['STUDENT'], tx);
    await lock(tx, `career:${a.id}`);
    await eligible(a.id, tx);
    const j = await tx.opportunity.findUnique({
      where: { id: b.opportunityId },
      include: { employer: true },
    });
    ensure(
      j &&
        j.status === 'PUBLISHED' &&
        j.moderation === 'APPROVED' &&
        j.deadline &&
        j.deadline > new Date() &&
        j.employer.verificationStatus === 'VERIFIED' &&
        j.employer.verifiedAt,
      409,
      'JOB_CLOSED',
      'This opening is not accepting applications.',
    );
    ensure(
      !(await tx.hiringApplication.findUnique({
        where: { userId_opportunityId: { userId: a.id, opportunityId: j.id } },
      })),
      409,
      'DUPLICATE',
      'You already have an application for this opening.',
    );
    const p = await tx.careerProfile.findUnique({ where: { userId: a.id } });
    ensure(
      p?.consentedAt && p.visibility !== 'PRIVATE' && b.shareConsent,
      422,
      'CONSENT',
      'Enable profile visibility and agree to share with this employer.',
    );
    if (b.submit)
      await tx.careerConsent.upsert({
        where: {
          userId_employerId: { userId: a.id, employerId: j.employerId },
        },
        create: { userId: a.id, employerId: j.employerId },
        update: {
          revokedAt: null,
          grantedAt: new Date(),
          version: { increment: 1 },
        },
      });
    const app = await tx.hiringApplication.create({
      data: {
        userId: a.id,
        opportunityId: j.id,
        statement: b.statement,
        status: b.submit ? 'APPLIED' : 'DRAFT',
        appliedAt: b.submit ? new Date() : null,
      },
    });
    await tx.hiringHistory.create({
      data: {
        applicationId: app.id,
        actorId: a.id,
        fromStatus: '',
        toStatus: app.status,
        note: 'Candidate accepted career-v1 employer sharing notice.',
      },
    });
    await audit(
      tx,
      a.id,
      'HIRING_APPLICATION_CREATED',
      'HiringApplication',
      app.id,
      {
        status: app.status,
        employerId: j.employerId,
        consentVersion: 'career-v1',
      },
    );
    if (b.submit)
      await notify(
        tx,
        j.employer.userId,
        'New job application',
        '/career/employer',
      );
    return { id: app.id };
  });
}
export async function moveApplication(a: Actor, input: unknown) {
  const b = z
    .object({
      id,
      version,
      status: z.enum([
        'APPLIED',
        'SCREENING',
        'SHORTLISTED',
        'INTERVIEW',
        'OFFERED',
        'HIRED',
        'REJECTED',
        'WITHDRAWN',
        'CLOSED',
      ]),
      note: text,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await lock(tx, `hiring:${b.id}`);
    const p = await applicationAccess(a, b.id, tx);
    current(p.version, b.version);
    ensure(
      hiringTransitions[p.status]?.includes(b.status),
      409,
      'TRANSITION',
      'Invalid application transition.',
    );
    if (a.role === 'STUDENT') {
      ensure(
        b.status === 'WITHDRAWN' ||
          (p.status === 'DRAFT' && b.status === 'APPLIED'),
        403,
        'PIPELINE',
        'Candidates may submit or withdraw their own application.',
      );
      if (b.status === 'APPLIED') {
        await eligible(a.id, tx);
        const j = p.opportunity;
        ensure(
          j.status === 'PUBLISHED' &&
            j.moderation === 'APPROVED' &&
            j.deadline &&
            j.deadline > new Date() &&
            j.employer.verificationStatus === 'VERIFIED',
          409,
          'JOB_CLOSED',
          'Opening is closed.',
        );
        const profile = await tx.careerProfile.findUnique({
          where: { userId: a.id },
        });
        ensure(
          profile?.consentedAt && profile.visibility !== 'PRIVATE',
          403,
          'CONSENT',
          'Enable sharing first.',
        );
        await tx.careerConsent.upsert({
          where: {
            userId_employerId: { userId: a.id, employerId: j.employerId },
          },
          create: { userId: a.id, employerId: j.employerId },
          update: {
            revokedAt: null,
            grantedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
    } else {
      ensure(
        b.status !== 'APPLIED' && b.status !== 'WITHDRAWN',
        403,
        'PIPELINE',
        'This transition belongs to the candidate.',
      );
      if (a.role === 'EMPLOYER') await consentAccess(a, p.userId, tx);
    }
    ensure(
      b.status !== 'OFFERED',
      409,
      'OFFER',
      'Record an actual offer through the offer workflow.',
    );
    ensure(
      b.status !== 'HIRED',
      409,
      'JOINING',
      'An administrator must verify actual joining separately.',
    );
    const r = await tx.hiringApplication.update({
      where: { id: p.id },
      data: {
        status: b.status,
        version: { increment: 1 },
        ...(b.status === 'APPLIED' ? { appliedAt: new Date() } : {}),
      },
    });
    if (['WITHDRAWN', 'REJECTED', 'CLOSED'].includes(b.status))
      await tx.hiringInterview.updateMany({
        where: {
          applicationId: p.id,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          endsAt: { gt: new Date() },
        },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
    await tx.hiringHistory.create({
      data: {
        applicationId: p.id,
        actorId: a.id,
        fromStatus: p.status,
        toStatus: b.status,
        note: b.note,
      },
    });
    await audit(tx, a.id, 'HIRING_STATUS_CHANGED', 'HiringApplication', p.id, {
      from: p.status,
      to: b.status,
      note: b.note,
    });
    await notify(
      tx,
      p.userId,
      `Application status: ${b.status.toLowerCase().replaceAll('_', ' ')}`,
      `/career/applications/${p.id}`,
    );
    return { id: r.id };
  });
}
export async function outcome(a: Actor, input: unknown) {
  const b = z
    .object({
      applicationId: id,
      version,
      action: z.enum(['RECORD_OFFER', 'VERIFY_OFFER', 'VERIFY_JOINING']),
      reference: text,
      date: z.iso.datetime(),
      note: text,
    })
    .strict()
    .parse(input);
  ensure(
    new Date(b.date) <= new Date(),
    422,
    'FUTURE',
    'Verification cannot record a future event.',
  );
  return serial(async (tx) => {
    await lock(tx, `hiring:${b.applicationId}`);
    const app = await applicationAccess(a, b.applicationId, tx);
    const old = await tx.hiringOutcome.findUnique({
      where: { applicationId: app.id },
    });
    current(old?.version ?? 0, b.version);
    ensure(
      a.role === 'EMPLOYER' || a.role === 'ADMIN',
      403,
      'OUTCOME',
      'Recruiter or administrator access required.',
    );
    let data;
    if (b.action === 'RECORD_OFFER') {
      ensure(
        app.status === 'INTERVIEW' && !old,
        409,
        'OFFER',
        'An offer can be recorded once after the interview stage.',
      );
      if (a.role === 'EMPLOYER') await consentAccess(a, app.userId, tx);
      data = { offerReference: b.reference, offeredAt: new Date(b.date) };
      await tx.hiringApplication.update({
        where: { id: app.id },
        data: { status: 'OFFERED', version: { increment: 1 } },
      });
      await tx.hiringHistory.create({
        data: {
          applicationId: app.id,
          actorId: a.id,
          fromStatus: app.status,
          toStatus: 'OFFERED',
          note: b.note,
        },
      });
    } else {
      await role(a, ['ADMIN'], tx);
      ensure(
        old?.offeredAt && app.status === 'OFFERED',
        409,
        'OFFER',
        'An active recorded offer is required.',
      );
      if (b.action === 'VERIFY_OFFER') {
        ensure(
          !old.offerVerifiedAt,
          409,
          'VERIFIED',
          'Offer already verified.',
        );
        data = { offerVerifiedAt: new Date(), offerVerifierId: a.id };
      } else {
        ensure(
          old.offerVerifiedAt &&
            !old.joiningVerifiedAt &&
            new Date(b.date) >= old.offeredAt,
          409,
          'JOINING',
          'Verify the offer first; actual joining must follow the offer.',
        );
        data = {
          joinedAt: new Date(b.date),
          joiningVerifiedAt: new Date(),
          joiningVerifierId: a.id,
        };
        await tx.hiringApplication.update({
          where: { id: app.id },
          data: { status: 'HIRED', version: { increment: 1 } },
        });
        await tx.hiringHistory.create({
          data: {
            applicationId: app.id,
            actorId: a.id,
            fromStatus: app.status,
            toStatus: 'HIRED',
            note: b.note,
          },
        });
      }
    }
    if (b.action === 'VERIFY_JOINING')
      await tx.hiringInterview.updateMany({
        where: {
          applicationId: app.id,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          endsAt: { gt: new Date() },
        },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
    const r = await tx.hiringOutcome.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, ...data, verificationNote: b.note },
      update: { ...data, verificationNote: b.note, version: { increment: 1 } },
    });
    await audit(tx, a.id, b.action, 'HiringOutcome', app.id, {
      reference: b.reference,
      note: b.note,
      eventDate: b.date,
      version: r.version,
    });
    await notify(
      tx,
      app.userId,
      b.action === 'RECORD_OFFER'
        ? 'An employer recorded an offer'
        : b.action === 'VERIFY_OFFER'
          ? 'Your offer was verified'
          : 'Your job start was verified',
      `/career/applications/${app.id}`,
    );
    return { id: app.id };
  });
}

export async function updateCompany(a: Actor, input: unknown) {
  const b = z
    .object({
      version,
      companyName: label,
      website: https,
      businessEmail: z.email().max(200),
      recruiterName: label,
      industry: label,
      location: label,
      requirements: text,
    })
    .strict()
    .parse(input);
  const domain = new URL(b.website).hostname.replace(/^www\./, '');
  ensure(
    b.businessEmail.split('@')[1].toLowerCase() === domain,
    422,
    'DOMAIN',
    'Use a matching official company email domain.',
  );
  return serial(async (tx) => {
    const e = await company(a, tx, false);
    await lock(tx, `employer:${e.id}`);
    const fresh = await tx.employer.findUniqueOrThrow({ where: { id: e.id } });
    current(fresh.version, b.version);
    ensure(
      fresh.verificationStatus !== 'SUSPENDED',
      403,
      'SUSPENDED',
      'Ask an administrator to reopen review before changing a suspended company.',
    );
    const { version: _, ...data } = b;
    void _;
    await tx.employer.update({
      where: { id: e.id },
      data: {
        ...data,
        verificationStatus: 'PENDING_REVIEW',
        verifiedAt: null,
        reviewedBy: null,
        reviewNote: 'Company identity changed; administrative review required.',
        version: { increment: 1 },
      },
    });
    await tx.opportunity.updateMany({
      where: { employerId: e.id, status: 'PUBLISHED' },
      data: {
        status: 'DRAFT',
        moderation: 'PENDING',
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'EMPLOYER_PROFILE_CHANGED', 'Employer', e.id, {
      previousStatus: fresh.verificationStatus,
      requiresReview: true,
    });
    return { id: e.id };
  });
}
