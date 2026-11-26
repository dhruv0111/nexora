import 'server-only';
import { getDb } from './db';
import { hashInquiryValue } from './inquiry-policy';
import type { InquiryInput } from './inquiry-validation';
export class InquiryLimitError extends Error {}
export class InquiryConflictError extends Error {}
export async function saveInquiry(
  input: InquiryInput,
  nonce: string,
  secret: string,
  ip: string | null,
) {
  const db = getDb();
  const fingerprint = hashInquiryValue(
    secret,
    JSON.stringify({
      name: input.name,
      email: input.email,
      program: input.program,
      intent: input.intent,
      message: input.message,
    }),
  );
  const existing = await db.inquiry.findUnique({
    where: { submissionKey: nonce },
    select: { id: true, fingerprint: true },
  });
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new InquiryConflictError();
    return existing.id;
  }
  const now = new Date();
  const windowKey = Math.floor(now.getTime() / 600000);
  const buckets = [
    {
      key: hashInquiryValue(secret, `email:${input.email}:${windowKey}`),
      limit: 3,
    },
  ];
  // Only trust x-forwarded-for behind a proxy that overwrites it; configure this at deployment.
  if (ip)
    buckets.push({
      key: hashInquiryValue(secret, `ip:${ip}:${windowKey}`),
      limit: 20,
    });
  try {
    return await db.$transaction(async (tx) => {
      for (const bucket of buckets.sort((a, b) => a.key.localeCompare(b.key))) {
        const row = await tx.inquiryRateBucket.upsert({
          where: { key: bucket.key },
          create: {
            key: bucket.key,
            count: 1,
            expiresAt: new Date((windowKey + 1) * 600000),
          },
          update: { count: { increment: 1 } },
        });
        if (row.count > bucket.limit) throw new InquiryLimitError();
      }
      const record = await tx.inquiry.create({
        data: {
          name: input.name,
          email: input.email,
          program: input.program,
          intent: input.intent,
          message: input.message || null,
          consentedAt: now,
          noticeVersion: 'inquiry-v1',
          submissionKey: nonce,
          fingerprint,
        },
      });
      await tx.inquiryRateBucket.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      return record.id;
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      const retry = await db.inquiry.findUnique({
        where: { submissionKey: nonce },
        select: { id: true, fingerprint: true },
      });
      if (retry?.fingerprint === fingerprint) return retry.id;
    }
    throw error;
  }
}
