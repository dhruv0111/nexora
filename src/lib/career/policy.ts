import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import type { Tx } from '@/lib/domain/transaction';
export const id = z.string().min(1).max(100);
export const label = z.string().trim().min(2).max(180);
export const text = z.string().trim().min(10).max(12000);
export const short = z.string().trim().max(2000);
export const tags = z.array(label).max(30);
export const version = z.number().int().nonnegative();
export const https = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Use an HTTPS URL without credentials.');
export async function role(
  a: Actor,
  allowed: readonly string[],
  db: Tx = getDb(),
) {
  const u = await db.user.findUnique({
    where: { id: a.id },
    select: { role: true },
  });
  ensure(
    u?.role === a.role && allowed.includes(a.role),
    403,
    'CAREER_ROLE',
    'This account cannot perform that action.',
  );
}
export function current(actual: number, expected: number) {
  ensure(
    actual === expected,
    409,
    'VERSION',
    'This record changed. Refresh before saving.',
  );
}
export async function company(a: Actor, db: Tx = getDb(), verified = true) {
  await role(a, ['EMPLOYER'], db);
  const e = await db.employer.findUnique({ where: { userId: a.id } });
  ensure(e, 404, 'COMPANY', 'Register your company first.');
  ensure(
    !verified || (e.verificationStatus === 'VERIFIED' && e.verifiedAt),
    403,
    'VERIFICATION',
    'Administrative company verification is required.',
  );
  return e;
}
export const paid = {
  payments: {
    some: {
      status: 'SUCCEEDED' as const,
      verifiedAt: { not: null },
      providerRef: { not: null },
      refundedMinor: 0,
    },
  },
  status: { in: ['ACTIVE' as const, 'COMPLETED' as const] },
  cohort: {
    status: 'PUBLISHED' as const,
    course: { status: 'PUBLISHED' as const, contentApprovedAt: { not: null } },
  },
};
export async function eligible(userId: string, db: Tx = getDb()) {
  const e = await db.enrollment.findFirst({ where: { userId, ...paid } });
  const r = await db.careerReadiness.findUnique({ where: { userId } });
  ensure(
    e && r?.ready,
    403,
    'READINESS',
    'A verified paid enrollment and staff-reviewed career readiness are required.',
  );
}
export async function staffStudent(a: Actor, userId: string, db: Tx = getDb()) {
  await role(a, ['ADMIN', 'MENTOR'], db);
  const u = await db.user.findFirst({
    where: {
      id: userId,
      role: 'STUDENT',
      ...(a.role === 'MENTOR'
        ? {
            enrollments: {
              some: {
                cohort: { mentors: { some: { mentor: { userId: a.id } } } },
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  ensure(u, 404, 'STUDENT', 'Assigned student not found.');
}
export const hiringTransitions: Record<string, readonly string[]> = {
  DRAFT: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['SCREENING', 'REJECTED', 'WITHDRAWN', 'CLOSED'],
  SCREENING: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'CLOSED'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED', 'WITHDRAWN', 'CLOSED'],
  INTERVIEW: ['OFFERED', 'REJECTED', 'WITHDRAWN', 'CLOSED'],
  OFFERED: ['HIRED', 'WITHDRAWN', 'CLOSED'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
  CLOSED: [],
};
export async function applicationAccess(
  a: Actor,
  applicationId: string,
  db: Tx = getDb(),
) {
  await role(a, ['STUDENT', 'EMPLOYER', 'ADMIN'], db);
  const app = await db.hiringApplication.findUnique({
    where: { id: applicationId },
    include: { opportunity: { include: { employer: true } } },
  });
  ensure(app, 404, 'APPLICATION', 'Application not found.');
  if (a.role === 'STUDENT')
    ensure(app.userId === a.id, 404, 'APPLICATION', 'Application not found.');
  if (a.role === 'EMPLOYER') {
    const e = await company(a, db);
    ensure(
      app.opportunity.employerId === e.id && app.status !== 'DRAFT',
      404,
      'APPLICATION',
      'Application not found.',
    );
  }
  return app;
}
export async function consentAccess(
  a: Actor,
  userId: string,
  db: Tx = getDb(),
) {
  await role(a, ['STUDENT', 'EMPLOYER', 'ADMIN'], db);
  const p = await db.careerProfile.findUnique({ where: { userId } });
  ensure(p, 404, 'PROFILE', 'Profile not found.');
  if (a.role === 'STUDENT')
    ensure(userId === a.id, 404, 'PROFILE', 'Profile not found.');
  if (a.role === 'EMPLOYER') {
    const e = await company(a, db);
    const grant = await db.careerConsent.findUnique({
      where: { userId_employerId: { userId, employerId: e.id } },
    });
    ensure(
      p.visibility !== 'PRIVATE' &&
        p.consentedAt &&
        !grant?.revokedAt &&
        (p.seeking || grant),
      404,
      'CONSENT',
      'Profile unavailable or sharing withdrawn.',
    );
    await eligible(userId, db);
  }
  return p;
}
