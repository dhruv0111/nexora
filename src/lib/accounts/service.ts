import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { ensure } from '@/lib/domain/errors';
import { audit, serial, lock } from '@/lib/domain/transaction';
import { strong, hashPassword, matches } from './password.mjs';
const emailSchema = z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  pass = z.string().min(1).max(128),
  digest = (s: string) => createHash('sha256').update(s).digest('hex');
function transport() {
  const host = process.env.SMTP_HOST,
    from = process.env.SMTP_FROM,
    port = Number(process.env.SMTP_PORT || 587);
  ensure(
    host && from && env.NEXTAUTH_URL,
    503,
    'MAIL',
    'Email delivery is not configured.',
  );
  const local =
    ['127.0.0.1', 'localhost', '::1'].includes(host) &&
    new URL(env.NEXTAUTH_URL).hostname === '127.0.0.1';
  ensure(
    local || env.NEXTAUTH_URL.startsWith('https://'),
    503,
    'MAIL',
    'Secure email delivery is not configured.',
  );
  return {
    from,
    client: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: !local,
      ignoreTLS: local,
      connectionTimeout: 6000,
      socketTimeout: 10000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    }),
  };
}
async function find(email: string) {
  const rows = await getDb().user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { credential: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0] : null;
}
export async function requestLink(
  action: 'register' | 'forgot-password',
  input: unknown,
) {
  const schema = z.object({ email: emailSchema });
  const b =
    action === 'register'
      ? schema
          .extend({ password: pass, role: z.enum(['STUDENT', 'EMPLOYER']) })
          .strict()
          .parse(input)
      : schema.strict().parse(input);
  const mail = transport();
  const register =
    'password' in b
      ? (b as { email: string; password: string; role: 'STUDENT' | 'EMPLOYER' })
      : null;
  if (register)
    ensure(
      strong(register.password, b.email),
      422,
      'WEAK',
      'Choose a unique password of 14–128 characters.',
    );
  const hash = register ? await hashPassword(register.password) : undefined;
  const token = randomBytes(32).toString('hex'),
    purpose = register ? 'verify' : 'reset';
  const recipient = await serial(async (tx) => {
    await lock(tx, 'account:' + b.email);
    const rows = await tx.user.findMany({
      where: { email: { equals: b.email, mode: 'insensitive' } },
      include: { credential: true },
      take: 2,
    });
    let user = rows[0];
    if (rows.length > 1 || user?.disabledAt) return null;
    if (register) {
      if (user) return null;
      user = await tx.user.create({
        data: {
          email: b.email,
          role: register.role,
          credential: { create: { hash: hash! } },
        },
        include: { credential: true },
      });
    } else if (!user) return null;
    await tx.accountToken.deleteMany({ where: { userId: user.id, purpose } });
    await tx.accountToken.create({
      data: {
        digest: digest(token),
        userId: user.id,
        purpose,
        expiresAt: new Date(Date.now() + 20 * 60000),
      },
    });
    await audit(tx, user.id, 'ACCOUNT_LINK_REQUESTED', 'User', user.id, {
      purpose,
    });
    return user.email;
  });
  if (recipient) {
    const url = new URL(
      '/account/' + (register ? 'verify-email' : 'reset-password'),
      env.NEXTAUTH_URL,
    );
    url.hash = token;
    try {
      await mail.client.sendMail({
        from: mail.from,
        to: recipient,
        subject: 'NEXORA account security',
        text:
          'Open this link within 20 minutes to complete your request:\n' +
          url.href,
      });
    } catch {
      ensure(
        false,
        503,
        'MAIL',
        'Delivery unavailable. Try password recovery later.',
      );
    }
  }
  return {
    message:
      'If eligible, your account will receive an email with the next step.',
  };
}
export async function redeem(
  action: 'verify-email' | 'reset-password',
  input: unknown,
) {
  const b = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: pass })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const d = digest(b.token);
    await lock(tx, 'token:' + d);
    const t = await tx.accountToken.findUnique({
      where: { digest: d },
      include: { user: { include: { credential: true } } },
    });
    ensure(
      t &&
        t.purpose === (action === 'verify-email' ? 'verify' : 'reset') &&
        t.expiresAt > new Date() &&
        !t.user.disabledAt,
      400,
      'LINK',
      'This link is invalid or expired.',
    );
    if (action === 'verify-email')
      ensure(
        await matches(b.password, t.user.credential?.hash),
        400,
        'LINK',
        'Enter the password used at registration.',
      );
    else {
      ensure(
        strong(b.password, t.user.email ?? ''),
        422,
        'WEAK',
        'Choose a unique password of at least 14 characters.',
      );
      const hash = await hashPassword(b.password);
      await tx.passwordCredential.upsert({
        where: { userId: t.userId },
        create: { userId: t.userId, hash },
        update: { hash },
      });
    }
    await tx.user.update({
      where: { id: t.userId },
      data: { emailVerified: new Date(), forceChange: false },
    });
    await tx.session.deleteMany({ where: { userId: t.userId } });
    await tx.accountToken.deleteMany({ where: { userId: t.userId } });
    await audit(tx, t.userId, 'ACCOUNT_LINK_CONSUMED', 'User', t.userId, {
      action,
    });
    return { redirect: '/sign-in' };
  });
}
export async function login(input: unknown) {
  const b = z
      .object({ email: emailSchema, password: pass })
      .strict()
      .parse(input),
    u = await find(b.email);
  const ok = await matches(b.password, u?.credential?.hash);
  ensure(
    ok && u && !u.disabledAt && u.emailVerified,
    401,
    'CREDENTIALS',
    'Email or password is incorrect, or the account is unavailable.',
  );
  return serial(async (tx) => {
    const fresh = await tx.user.findUnique({
      where: { id: u.id },
      include: { credential: true },
    });
    ensure(
      fresh &&
        !fresh.disabledAt &&
        fresh.credential?.hash === u.credential?.hash,
      401,
      'CREDENTIALS',
      'Please sign in again.',
    );
    const sessionToken = randomBytes(32).toString('hex'),
      expires = new Date(Date.now() + 7 * 86400000);
    await tx.session.create({ data: { userId: u.id, sessionToken, expires } });
    return {
      sessionToken,
      expires,
      redirect: fresh.forceChange
        ? '/account/change-password'
        : fresh.role === 'ADMIN'
          ? '/operations'
          : '/dashboard',
    };
  });
}
export async function change(userId: string, input: unknown) {
  const b = z
    .object({ currentPassword: pass, password: pass })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      include: { credential: true },
    });
    ensure(
      u &&
        !u.disabledAt &&
        (await matches(b.currentPassword, u.credential?.hash)),
      403,
      'PASSWORD',
      'Current password is incorrect.',
    );
    ensure(
      b.password !== b.currentPassword && strong(b.password, u.email ?? ''),
      422,
      'WEAK',
      'Choose a different strong password of at least 14 characters.',
    );
    await tx.passwordCredential.update({
      where: { userId },
      data: { hash: await hashPassword(b.password) },
    });
    await tx.user.update({
      where: { id: userId },
      data: { forceChange: false },
    });
    await tx.accountToken.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, userId, 'PASSWORD_CHANGED', 'User', userId);
    return { redirect: '/sign-in' };
  });
}
