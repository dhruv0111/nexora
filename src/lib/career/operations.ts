import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
import type { Actor } from '@/lib/domain/http';
import { validateFile } from '@/lib/learning/files';
import { env } from '@/lib/env';
import { id, label, text, role, company } from './policy';
export async function documentUpload(a: Actor, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    meta = validateFile(file.name, file.type, bytes);
  return serial(async (tx) => {
    const e = await company(a, tx, false);
    await lock(tx, `documents:${a.id}`);
    ensure(
      (await tx.careerDocument.count({
        where: { userId: a.id, removedAt: null },
      })) < 5,
      422,
      'QUOTA',
      'Retire a document before uploading more than five.',
    );
    const d = await tx.careerDocument.create({
      data: { userId: a.id, employerId: e.id, ...meta, bytes },
    });
    await audit(tx, a.id, 'COMPANY_DOCUMENT_UPLOADED', 'CareerDocument', d.id, {
      sha256: meta.sha256,
      size: meta.size,
    });
    return { id: d.id };
  });
}
export async function documentRead(a: Actor, documentId: string) {
  await role(a, ['ADMIN', 'EMPLOYER']);
  const d = await getDb().careerDocument.findUnique({
    where: { id: documentId },
  });
  ensure(
    d?.bytes && !d.removedAt && (a.role === 'ADMIN' || d.userId === a.id),
    404,
    'DOCUMENT',
    'Document not found.',
  );
  return d;
}
export async function retire(a: Actor, input: unknown) {
  const b = z
    .object({ id, kind: z.enum(['RESUME', 'DOCUMENT']), reason: text })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['ADMIN', 'STUDENT', 'EMPLOYER'], tx);
    if (b.kind === 'RESUME') {
      const r = await tx.careerResume.findUnique({ where: { id: b.id } });
      ensure(
        r && (a.role === 'ADMIN' || r.userId === a.id),
        404,
        'RESUME',
        'Resume not found.',
      );
      await tx.careerResume.update({
        where: { id: b.id },
        data: { content: null, retiredAt: new Date() },
      });
    } else {
      const d = await tx.careerDocument.findUnique({ where: { id: b.id } });
      ensure(
        d && (a.role === 'ADMIN' || d.userId === a.id),
        404,
        'DOCUMENT',
        'Document not found.',
      );
      await tx.careerDocument.update({
        where: { id: d.id },
        data: { bytes: null, removedAt: new Date() },
      });
    }
    await audit(tx, a.id, 'CAREER_ARTIFACT_RETIRED', b.kind, b.id, {
      reason: b.reason,
    });
    return { id: b.id };
  });
}
export async function retention(a: Actor, input: unknown) {
  const b = z.object({ reason: text }).strict().parse(input);
  return serial(async (tx) => {
    await role(a, ['ADMIN'], tx);
    const cutoff = new Date(Date.now() - env.CAREER_RETENTION_DAYS * 86400000);
    const documents = await tx.careerDocument.updateMany({
      where: { createdAt: { lt: cutoff }, removedAt: null },
      data: { bytes: null, removedAt: new Date() },
    });
    const resumes = await tx.careerResume.updateMany({
      where: { createdAt: { lt: cutoff }, retiredAt: null },
      data: { content: null, retiredAt: new Date() },
    });
    await audit(
      tx,
      a.id,
      'CAREER_RETENTION_APPLIED',
      'CareerRetention',
      'career',
      {
        cutoff: cutoff.toISOString(),
        days: env.CAREER_RETENTION_DAYS,
        documents: documents.count,
        resumes: resumes.count,
        reason: b.reason,
      },
    );
    return { documents: documents.count, resumes: resumes.count };
  });
}
export async function contract(a: Actor, input: unknown) {
  const b = z
    .object({
      employerId: id,
      reference: label,
      feeType: z.enum(['FIXED', 'PERCENTAGE']),
      feeValue: z.number().int().min(0).max(1000000000),
      currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
      replacementDays: z.number().int().min(0).max(3650),
      refundDays: z.number().int().min(0).max(3650),
    })
    .strict()
    .parse(input);
  ensure(
    b.feeType !== 'PERCENTAGE' || b.feeValue <= 10000,
    422,
    'FEE',
    'Percentage fees use basis points up to 10000.',
  );
  return serial(async (tx) => {
    await role(a, ['ADMIN'], tx);
    ensure(
      await tx.employer.findUnique({ where: { id: b.employerId } }),
      404,
      'COMPANY',
      'Company not found.',
    );
    const c = await tx.recruitmentContract.create({ data: b });
    await audit(
      tx,
      a.id,
      'RECRUITMENT_CONTRACT_DRAFTED',
      'RecruitmentContract',
      c.id,
      { status: 'DRAFT', billingEnabled: false },
    );
    return { id: c.id };
  });
}
export async function invoice(a: Actor, input: unknown) {
  const b = z
    .object({
      contractId: id,
      reference: label,
      amountMinor: z.number().int().min(1).max(1000000000),
      currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
    })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['ADMIN'], tx);
    const c = await tx.recruitmentContract.findUnique({
      where: { id: b.contractId },
    });
    ensure(
      c && c.currency === b.currency,
      422,
      'CONTRACT',
      'Use an existing contract with matching currency.',
    );
    const r = await tx.recruitmentInvoice.create({ data: b });
    await audit(
      tx,
      a.id,
      'RECRUITMENT_INVOICE_DRAFTED',
      'RecruitmentInvoice',
      r.id,
      { billingEnabled: false },
    );
    return { id: r.id };
  });
}
export async function recommend(a: Actor, input: unknown) {
  const b = z
    .object({ userId: id, opportunityId: id, note: text })
    .strict()
    .parse(input);
  return serial(async (tx) => {
    await role(a, ['ADMIN'], tx);
    const j = await tx.opportunity.findUnique({
      where: { id: b.opportunityId },
      include: { employer: true },
    });
    ensure(
      j?.status === 'PUBLISHED' &&
        j.moderation === 'APPROVED' &&
        j.deadline &&
        j.deadline > new Date() &&
        j.employer.verificationStatus === 'VERIFIED',
      409,
      'JOB',
      'Recommend a current moderated opening.',
    );
    ensure(
      await tx.user.findFirst({ where: { id: b.userId, role: 'STUDENT' } }),
      404,
      'STUDENT',
      'Student not found.',
    );
    await tx.learningNotification.create({
      data: {
        userId: b.userId,
        title: `Career recommendation: ${j.title}`,
        href: `/career/jobs/${j.id}`,
      },
    });
    await audit(tx, a.id, 'CAREER_RECOMMENDATION', 'Opportunity', j.id, {
      userId: b.userId,
      note: b.note,
      sharedWithEmployer: false,
    });
    return { id: j.id };
  });
}
