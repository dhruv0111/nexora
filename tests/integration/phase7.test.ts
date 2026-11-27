import { it, expect, vi } from 'vitest';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { getDb } from '@/lib/db';
import { login, redeem, requestLink, change } from '@/lib/accounts/service';
import { authorize, mutate, finance } from '@/lib/operations/service';
import { fixture } from './fixtures';
const { letters } = vi.hoisted(() => ({ letters: [] as string[] }));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { text: string }) => {
        letters.push(m.text);
      },
    }),
  },
}));
const secret = () => randomBytes(28).toString('base64url');
it.each(['STUDENT', 'EMPLOYER'])(
  'verifies registration, login, recovery and revocation for %s',
  async (role) => {
    const db = getDb(),
      email = randomUUID() + '@example.test',
      password = secret();
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_FROM = 'test@example.test';
    const { env } = await import('@/lib/env');
    const old = env.NEXTAUTH_URL;
    env.NEXTAUTH_URL = 'http://127.0.0.1:3100';
    try {
      await requestLink('register', { email, password, role });
      const u = await db.user.findUniqueOrThrow({
        where: { email },
        include: { credential: true },
      });
      expect(u.credential?.hash).toMatch(/^scrypt-v1:/);
      expect(u.credential?.hash).not.toContain(password);
      await expect(login({ email, password })).rejects.toMatchObject({
        status: 401,
      });
      const token = letters.at(-1)!.split('#')[1];
      await redeem('verify-email', { token, password });
      await expect(
        redeem('verify-email', { token, password }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(login({ email, password: secret() })).rejects.toMatchObject({
        status: 401,
      });
      const session = await login({ email, password });
      expect(
        await db.session.count({
          where: { sessionToken: session.sessionToken },
        }),
      ).toBe(1);
      await requestLink('forgot-password', { email });
      const expired = letters.at(-1)!.split('#')[1];
      await db.accountToken.update({
        where: { digest: createHash('sha256').update(expired).digest('hex') },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        redeem('reset-password', { token: expired, password: secret() }),
      ).rejects.toMatchObject({ status: 400 });
      await requestLink('forgot-password', { email });
      const reset = letters.at(-1)!.split('#')[1],
        next = secret();
      await redeem('reset-password', { token: reset, password: next });
      expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
      await expect(
        redeem('reset-password', { token: reset, password: secret() }),
      ).rejects.toMatchObject({ status: 400 });
      await login({ email, password: next });
      const final = secret();
      await change(u.id, { currentPassword: next, password: final });
      expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
      await db.user.update({
        where: { id: u.id },
        data: { disabledAt: new Date() },
      });
      await expect(login({ email, password: final })).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      env.NEXTAUTH_URL = old;
      await db.user.deleteMany({ where: { email } });
      letters.length = 0;
    }
  },
  30000,
);
it('rejects privileged registration and weak passwords', async () => {
  await expect(
    requestLink('register', {
      email: 'nobody@example.test',
      role: 'ADMIN',
      password: secret(),
    }),
  ).rejects.toThrow();
  const { strong } = await import('@/lib/accounts/password.mjs');
  expect(strong('Password123456789')).toBe(false);
});
it('provisions one admin idempotently, forces rotation, and records recovery', async () => {
  const db = getDb(),
    email = randomUUID() + '@example.test',
    password = secret(),
    env = {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NEXORA_ADMIN_EMAIL: email,
      NEXORA_ADMIN_PASSWORD: password,
    };
  try {
    for (let i = 0; i < 2; i++)
      execFileSync(process.execPath, ['scripts/provision-admin.mjs'], {
        env,
        stdio: 'pipe',
      });
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    expect((await login({ email, password })).redirect).toBe(
      '/account/change-password',
    );
    await expect(authorize(u.id, 'SUPER_ADMIN')).rejects.toMatchObject({
      status: 403,
    });
    await change(u.id, { currentPassword: password, password: secret() });
    await authorize(u.id, 'SUPER_ADMIN');
    execFileSync(process.execPath, ['scripts/admin-recovery.mjs', 'disable'], {
      env,
      stdio: 'pipe',
    });
    await expect(authorize(u.id, 'SUPER_ADMIN')).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await db.auditLog.count({
        where: { actorId: u.id, action: 'SUPER_ADMIN_PROVISIONED' },
      }),
    ).toBe(1);
  } finally {
    await db.user.deleteMany({ where: { email } });
  }
}, 30000);
it('restricts staff reports and refund requests to verified funds', async () => {
  const t = await fixture(),
    db = t.db;
  try {
    await db.user.update({
      where: { id: t.admin.id },
      data: { staffScope: 'FINANCE_STAFF' },
    });
    await expect(
      authorize(t.admin.id, 'ADMISSIONS_STAFF'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      finance(t.student.id, new Date(0), new Date(), ''),
    ).rejects.toMatchObject({ status: 403 });
    const e = await db.enrollment.create({
        data: {
          cohortId: t.cohort.id,
          userId: t.student.id,
          status: 'PENDING',
        },
      }),
      p = await db.payment.create({
        data: {
          enrollmentId: e.id,
          amountMinor: 9100,
          provider: 'razorpay',
          currency: 'INR',
          idempotencyKey: randomUUID(),
        },
      });
    const b = {
      paymentId: p.id,
      amountMinor: 6000,
      reason: 'Isolated refund review request.',
      confirm: true,
    };
    await expect(mutate(t.admin.id, 'refund', b)).rejects.toMatchObject({
      status: 409,
    });
    await db.payment.update({
      where: { id: p.id },
      data: {
        status: 'SUCCEEDED',
        providerRef: randomUUID(),
        verifiedAt: new Date(),
      },
    });
    await mutate(t.admin.id, 'refund', b);
    await expect(mutate(t.admin.id, 'refund', b)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (await finance(t.admin.id, new Date(0), new Date(), t.cohort.id)).cash[0]
        ._sum.amountMinor,
    ).toBe(9100);
    expect(
      (await db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status,
    ).toBe('PENDING');
    await db.refundRequest.deleteMany({ where: { paymentId: p.id } });
  } finally {
    await t.cleanup();
  }
});

it('requires verified funds and an eligible admission for audited access approval', async () => {
  const t = await fixture();
  try {
    const app = await t.accepted();
    const e = await t.db.enrollment.create({
      data: {
        applicationId: app.id,
        userId: t.student.id,
        cohortId: t.cohort.id,
        status: 'REVIEW_REQUIRED',
        reviewReason: 'PAID_ELIGIBILITY_OR_CAPACITY_REVIEW',
        amountMinor: 9100,
        currency: 'INR',
        agreedAt: new Date(),
        agreementHash: 'fixture',
      },
    });
    const input = {
      enrollmentId: e.id,
      reason: 'Verified seat and current agreement reviewed.',
      confirm: true,
    };
    await expect(
      mutate(t.admin.id, 'approve-paid-review', input),
    ).rejects.toMatchObject({ status: 403 });
    await t.db.user.update({
      where: { id: t.admin.id },
      data: { staffScope: 'SUPER_ADMIN' },
    });
    await expect(
      mutate(t.admin.id, 'approve-paid-review', input),
    ).rejects.toMatchObject({ status: 409 });
    await t.db.payment.create({
      data: {
        enrollmentId: e.id,
        amountMinor: 9100,
        currency: 'INR',
        provider: 'razorpay',
        providerOrderId: randomUUID(),
        providerRef: randomUUID(),
        idempotencyKey: randomUUID(),
        verifiedAt: new Date(),
        status: 'SUCCEEDED',
      },
    });
    const attempts = await Promise.allSettled([
      mutate(t.admin.id, 'approve-paid-review', input),
      mutate(t.admin.id, 'approve-paid-review', input),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(
      await t.db.auditLog.count({
        where: { entityId: e.id, action: 'PAID_ACCESS_REVIEW_APPROVED' },
      }),
    ).toBe(1);
    expect(
      (await t.db.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status,
    ).toBe('ACTIVE');
  } finally {
    await t.cleanup();
  }
});
