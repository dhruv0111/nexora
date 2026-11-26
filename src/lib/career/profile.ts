import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import {
  id,
  label,
  text,
  short,
  tags,
  version,
  role,
  current,
  staffStudent,
  consentAccess,
  paid,
} from './policy';
import { exportPortfolio } from '@/lib/projects/evidence';
export async function saveProfile(a: Actor, input: unknown) {
  const b = z
    .object({
      version,
      displayName: label,
      headline: label,
      summary: text,
      education: short,
      background: short,
      experienceYears: z.number().int().min(0).max(60),
      skills: tags,
      preferredRoles: tags,
      locations: tags,
      workModes: z.array(z.enum(['REMOTE', 'HYBRID', 'ONSITE'])).max(3),
      eligibility: label,
      visibility: z.enum(['PRIVATE', 'EMPLOYERS', 'PUBLIC']),
      shareContact: z.boolean(),
      seeking: z.boolean(),
      consent: z.boolean(),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['STUDENT'], tx);
    await lock(tx, `career:${a.id}`);
    const old = await tx.careerProfile.findUnique({ where: { userId: a.id } });
    current(old?.version ?? 0, b.version);
    ensure(
      b.visibility === 'PRIVATE' || b.consent,
      422,
      'CONSENT',
      'Read and accept the sharing notice before enabling visibility.',
    );
    const { consent, version: expected, ...data } = b;
    const p = await tx.careerProfile.upsert({
      where: { userId: a.id },
      create: {
        userId: a.id,
        ...data,
        consentedAt: consent && b.visibility !== 'PRIVATE' ? new Date() : null,
      },
      update: {
        ...data,
        version: { increment: 1 },
        consentedAt: consent && b.visibility !== 'PRIVATE' ? new Date() : null,
      },
    });
    if (p.visibility === 'PRIVATE')
      await tx.careerConsent.updateMany({
        where: { userId: a.id, revokedAt: null },
        data: { revokedAt: new Date(), version: { increment: 1 } },
      });
    await audit(tx, a.id, 'CAREER_PROFILE_SAVED', 'CareerProfile', a.id, {
      version: p.version,
      visibility: p.visibility,
      directoryConsent: p.seeking,
      noticeVersion: 'career-v1',
      previousVersion: expected,
    });
    return { id: a.id, version: p.version };
  });
}
export async function consent(a: Actor, input: unknown) {
  const b = z
    .object({ employerId: id, grant: z.boolean() })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['STUDENT'], tx);
    await lock(tx, `career:${a.id}`);
    const p = await tx.careerProfile.findUnique({ where: { userId: a.id } });
    ensure(
      p && (!b.grant || (p.visibility !== 'PRIVATE' && p.consentedAt)),
      409,
      'CONSENT',
      'Enable profile sharing first.',
    );
    const e = await tx.employer.findUnique({ where: { id: b.employerId } });
    ensure(
      e?.verificationStatus === 'VERIFIED',
      404,
      'COMPANY',
      'Verified employer not found.',
    );
    const c = await tx.careerConsent.upsert({
      where: { userId_employerId: { userId: a.id, employerId: b.employerId } },
      create: {
        userId: a.id,
        employerId: b.employerId,
        revokedAt: b.grant ? null : new Date(),
      },
      update: {
        revokedAt: b.grant ? null : new Date(),
        grantedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await audit(
      tx,
      a.id,
      b.grant ? 'CAREER_CONSENT_GRANTED' : 'CAREER_CONSENT_REVOKED',
      'CareerConsent',
      c.id,
      { employerId: e.id, noticeVersion: 'career-v1' },
    );
    return { id: c.id };
  });
}
export async function createResume(a: Actor) {
  return serial(async (tx) => {
    await role(a, ['STUDENT'], tx);
    await lock(tx, `career:${a.id}`);
    const p = await tx.careerProfile.findUnique({ where: { userId: a.id } });
    ensure(p, 409, 'PROFILE', 'Save your career profile first.');
    const last = await tx.careerResume.findFirst({
      where: { userId: a.id },
      orderBy: { version: 'desc' },
    });
    const r = await tx.careerResume.create({
      data: {
        userId: a.id,
        version: (last?.version ?? 0) + 1,
        content: [
          p.displayName,
          p.headline,
          p.summary,
          'Education',
          p.education,
          'Self-reported professional background',
          p.background,
          `${p.experienceYears} self-reported years; training is not employment.`,
          p.skills.join(', '),
          'Supervised project portfolios are shared separately after mentor publication review.',
        ].join('\n\n'),
      },
    });
    await audit(tx, a.id, 'RESUME_CREATED', 'CareerResume', r.id, {
      version: r.version,
    });
    return { id: r.id };
  });
}
export async function readiness(userId: string) {
  const db = getDb();
  const [enrollments, assessments, contributions, mocks, review] =
    await Promise.all([
      db.enrollment.findMany({
        where: { userId, ...paid },
        select: { status: true, cohortId: true },
      }),
      db.assessmentAttempt.count({ where: { userId, passed: true } }),
      db.portfolioEntry.count({
        where: {
          userId,
          status: 'APPROVED',
          approvedAt: { not: null },
          evidence: {
            status: 'APPROVED',
            ticket: {
              pod: { project: { confidential: false, status: 'PUBLISHED' } },
            },
          },
        },
      }),
      db.careerMock.findMany({
        where: { userId, status: 'COMPLETED', score: { not: null } },
        select: { score: true },
        take: 100,
      }),
      db.careerReadiness.findUnique({ where: { userId } }),
    ]);
  const components = {
    assessments: assessments ? 20 : 0,
    graduation: enrollments.some((e) => e.status === 'COMPLETED') ? 20 : 0,
    approvedPortfolios: contributions ? 20 : 0,
    mockInterview: mocks.length
      ? Math.round(Math.max(...mocks.map((m) => m.score ?? 0)) / 5)
      : 0,
    communication: review?.communication ?? 0,
    preparation: review?.preparation ?? 0,
  };
  return {
    score:
      review?.overrideScore ??
      Object.values(components).reduce((a, b) => a + b, 0),
    components,
    review,
    paidEnrollmentCount: enrollments.length,
    graduates: enrollments.filter((e) => e.status === 'COMPLETED').length,
    assessmentPasses: assessments,
    approvedPortfolios: contributions,
    disclaimer:
      'Readiness supports career preparation and does not guarantee placement. Skills and professional background are self-reported unless explicitly reviewed.',
  };
}
export async function reviewReadiness(a: Actor, input: unknown) {
  const b = z
    .object({
      userId: id,
      version,
      ready: z.boolean(),
      communication: z.number().int().min(0).max(10),
      preparation: z.number().int().min(0).max(10),
      overrideScore: z.number().int().min(-1).max(100),
      reason: text,
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await staffStudent(a, b.userId, tx);
    await lock(tx, `career:${b.userId}`);
    const old = await tx.careerReadiness.findUnique({
      where: { userId: b.userId },
    });
    current(old?.version ?? 0, b.version);
    const { version: _, ...data } = b;
    void _;
    const r = await tx.careerReadiness.upsert({
      where: { userId: b.userId },
      create: {
        ...data,
        overrideScore: b.overrideScore < 0 ? null : b.overrideScore,
        reviewerId: a.id,
      },
      update: {
        ...data,
        overrideScore: b.overrideScore < 0 ? null : b.overrideScore,
        reviewerId: a.id,
        reviewedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await audit(tx, a.id, 'READINESS_REVIEWED', 'CareerReadiness', b.userId, {
      version: r.version,
      ready: r.ready,
      score: r.overrideScore,
      reason: b.reason,
    });
    return { id: b.userId };
  });
}
export async function candidate(a: Actor, userId: string) {
  const p = await consentAccess(a, userId),
    [portfolio, resume] = await Promise.all([
      exportPortfolio(userId),
      getDb().careerResume.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, createdAt: true, retiredAt: true },
      }),
    ]);
  const u = p.shareContact
    ? await getDb().user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
    : null;
  // Deliberately do not return source URLs, supervisor IDs, evidence IDs, mentor notes or internal project data.
  return {
    userId,
    displayName: p.displayName,
    headline: p.headline,
    summary: p.summary,
    education: p.education,
    background: p.background,
    experienceYears: p.experienceYears,
    skills: p.skills,
    preferences: {
      roles: p.preferredRoles,
      locations: p.locations,
      workModes: p.workModes,
    },
    eligibility: p.eligibility,
    email: u?.email ?? null,
    resume:
      resume && !resume.retiredAt
        ? {
            id: resume.id,
            version: resume.version,
            createdAt: resume.createdAt,
          }
        : null,
    portfolio: portfolio.entries.map((e) => ({
      project: e.project,
      description: e.description,
      technologies: e.technologies,
      challenges: e.challenges,
      outcome: e.mentorApprovedOutcome,
      engagementType: 'SUPERVISED_TRAINING',
    })),
  };
}
export async function publicProfile(userId: string) {
  const p = await getDb().careerProfile.findFirst({
    where: { userId, visibility: 'PUBLIC', consentedAt: { not: null } },
  });
  ensure(p, 404, 'PROFILE', 'Public profile not found.');
  const f = await exportPortfolio(userId);
  return {
    displayName: p.displayName,
    headline: p.headline,
    skills: p.skills,
    portfolio: f.entries.map((e) => ({
      project: e.project,
      description: e.description,
      technologies: e.technologies,
      outcome: e.mentorApprovedOutcome,
      engagementType: 'SUPERVISED_TRAINING',
    })),
  };
}
export async function resumeRead(a: Actor, resumeId: string) {
  const r = await getDb().careerResume.findUnique({ where: { id: resumeId } });
  ensure(r?.content && !r.retiredAt, 404, 'RESUME', 'Resume not found.');
  await consentAccess(a, r.userId);
  if (a.role === 'EMPLOYER') {
    const latest = await getDb().careerResume.findFirst({
      where: { userId: r.userId },
      orderBy: { version: 'desc' },
    });
    ensure(
      latest?.id === r.id,
      404,
      'RESUME',
      'This resume version is no longer shared.',
    );
  }
  return r;
}
