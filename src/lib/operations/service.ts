import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
import { serial, audit, lock, type Tx } from '@/lib/domain/transaction';
const scopes = [
  'ADMISSIONS_STAFF',
  'ACADEMIC_STAFF',
  'FINANCE_STAFF',
  'PLACEMENT_STAFF',
] as const;
export async function authorize(id: string, area: string, db: Tx = getDb()) {
  const u = await db.user.findUnique({
    where: { id },
    select: {
      role: true,
      disabledAt: true,
      forceChange: true,
      staffScope: true,
    },
  });
  ensure(
    u?.role === 'ADMIN' && !u.disabledAt && !u.forceChange,
    403,
    'OPERATIONS',
    'Operations access required.',
  );
  ensure(
    u.staffScope === 'SUPER_ADMIN' ||
      (area !== 'SUPER_ADMIN' && (!u.staffScope || u.staffScope === area)),
    403,
    'SCOPE',
    'This operation requires a different permission.',
  );
  return u;
}
const ref = z.string().min(1).max(150),
  note = z.string().trim().min(10).max(4000);
export async function mutate(actor: string, action: string, input: unknown) {
  return serial(async (tx) => {
    let entity = '',
      event = action;
    let metadata: Record<string, string | number | boolean> = {};
    switch (action) {
      case 'lead': {
        await authorize(actor, 'ADMISSIONS_STAFF', tx);
        const b = z
          .object({
            id: ref,
            status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED']),
            ownerId: z.string().max(100),
            followUpAt: z.string().max(40),
            applicationRef: z.string().max(100),
            suppressed: z.boolean(),
            note,
          })
          .strict()
          .parse(input);
        const l = await tx.inquiry.findUnique({ where: { id: b.id } });
        ensure(l, 404, 'LEAD', 'Lead not found.');
        if (b.ownerId)
          ensure(
            await tx.user.findFirst({
              where: {
                id: b.ownerId,
                role: 'ADMIN',
                disabledAt: null,
                OR: [
                  { staffScope: null },
                  { staffScope: { in: ['SUPER_ADMIN', 'ADMISSIONS_STAFF'] } },
                ],
              },
            }),
            422,
            'OWNER',
            'Choose admissions staff.',
          );
        if (b.applicationRef)
          ensure(
            await tx.application.findFirst({
              where: {
                id: b.applicationRef,
                user: { email: { equals: l.email, mode: 'insensitive' } },
              },
            }),
            422,
            'LINK',
            'Applicant email must match the lead.',
          );
        const due = b.followUpAt ? new Date(b.followUpAt) : null;
        ensure(
          !due || Number.isFinite(+due),
          422,
          'DATE',
          'Invalid follow-up date.',
        );
        await tx.inquiry.update({
          where: { id: b.id },
          data: {
            triageStatus: b.status,
            ownerId: b.ownerId || null,
            followUpAt: due,
            suppressed: b.suppressed,
            applicationRef: b.applicationRef || null,
            contacts: { create: { actorId: actor, note: b.note } },
          },
        });
        entity = b.id;
        metadata = { status: b.status, suppressed: b.suppressed };
        break;
      }
      case 'mentor': {
        await authorize(actor, 'ACADEMIC_STAFF', tx);
        const b = z
          .object({ mentorId: ref, cohortId: ref, availability: note })
          .strict()
          .parse(input);
        ensure(
          (await tx.mentor.findUnique({ where: { id: b.mentorId } })) &&
            (await tx.cohort.findUnique({ where: { id: b.cohortId } })),
          422,
          'ASSIGN',
          'Choose an existing mentor and cohort.',
        );
        await tx.cohortMentor.upsert({
          where: {
            cohortId_mentorId: { cohortId: b.cohortId, mentorId: b.mentorId },
          },
          create: { cohortId: b.cohortId, mentorId: b.mentorId },
          update: {},
        });
        await tx.mentorAvailability.upsert({
          where: { mentorId: b.mentorId },
          create: { mentorId: b.mentorId, availability: b.availability },
          update: { availability: b.availability },
        });
        entity = b.mentorId;
        metadata = { cohortId: b.cohortId };
        break;
      }
      case 'refund': {
        await authorize(actor, 'FINANCE_STAFF', tx);
        const b = z
          .object({
            paymentId: ref,
            amountMinor: z.number().int().positive(),
            reason: note,
            confirm: z.literal(true),
          })
          .strict()
          .parse(input);
        await lock(tx, 'refund:' + b.paymentId);
        const p = await tx.payment.findUnique({ where: { id: b.paymentId } });
        ensure(
          p?.verifiedAt &&
            p.providerRef &&
            ['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(p.status),
          409,
          'PAYMENT',
          'Verified collection required.',
        );
        const sum = await tx.refundRequest.aggregate({
          where: { paymentId: p.id, status: 'REQUESTED' },
          _sum: { amountMinor: true },
        });
        ensure(
          b.amountMinor <=
            p.amountMinor - p.refundedMinor - (sum._sum.amountMinor ?? 0),
          409,
          'AMOUNT',
          'Request exceeds available verified funds.',
        );
        const r = await tx.refundRequest.create({
          data: {
            actorId: actor,
            paymentId: p.id,
            amountMinor: b.amountMinor,
            reason: b.reason,
          },
        });
        entity = r.id;
        metadata = { paymentId: p.id, amountMinor: b.amountMinor };
        break;
      }
      case 'partner': {
        await authorize(actor, 'PLACEMENT_STAFF', tx);
        const b = z
          .object({
            employerId: ref,
            status: z.enum(['PROSPECT', 'SIGNED', 'ENDED']),
            reference: note,
          })
          .strict()
          .parse(input);
        ensure(
          await tx.employer.findFirst({
            where: { id: b.employerId, verificationStatus: 'VERIFIED' },
          }),
          409,
          'PARTNER',
          'Verify the company first.',
        );
        await tx.partnerStatus.upsert({
          where: { employerId: b.employerId },
          create: b,
          update: { status: b.status, reference: b.reference },
        });
        entity = b.employerId;
        metadata = { status: b.status, reference: b.reference };
        break;
      }
      case 'account': {
        await authorize(actor, 'SUPER_ADMIN', tx);
        const b = z
          .object({
            userId: ref,
            decision: z.enum(['REVOKE', 'DISABLE', 'ENABLE', ...scopes]),
            reason: note,
            confirm: z.literal(true),
          })
          .strict()
          .parse(input);
        const u = await tx.user.findUnique({ where: { id: b.userId } });
        ensure(
          u && u.id !== actor && u.staffScope !== 'SUPER_ADMIN',
          403,
          'PROTECTED',
          'Protected account.',
        );
        if (b.decision === 'DISABLE' || b.decision === 'ENABLE')
          await tx.user.update({
            where: { id: u.id },
            data: { disabledAt: b.decision === 'DISABLE' ? new Date() : null },
          });
        else if (b.decision !== 'REVOKE') {
          ensure(
            u.role === 'ADMIN',
            409,
            'STAFF',
            'Scope changes require an existing admin account.',
          );
          await tx.user.update({
            where: { id: u.id },
            data: { staffScope: b.decision },
          });
        }
        await tx.session.deleteMany({ where: { userId: u.id } });
        await tx.accountToken.deleteMany({ where: { userId: u.id } });
        entity = u.id;
        event = 'ACCOUNT_CONTROL';
        metadata = { decision: b.decision, reason: b.reason };
        break;
      }
      default:
        ensure(false, 404, 'ACTION', 'Unknown operation.');
    }
    await audit(tx, actor, event, 'Operations', entity, metadata);
    return { id: entity };
  });
}
export async function finance(
  id: string,
  from: Date,
  to: Date,
  cohortId: string,
) {
  await authorize(id, 'FINANCE_STAFF');
  const db = getDb();
  const where = {
    createdAt: { gte: from, lt: to },
    ...(cohortId ? { enrollment: { cohortId } } : {}),
  };
  const [cash, obligations, refunds, failed] = await Promise.all([
    db.payment.groupBy({
      by: ['currency'],
      where: {
        ...where,
        verifiedAt: { not: null },
        providerRef: { not: null },
        status: { in: ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
      },
      _sum: { amountMinor: true, refundedMinor: true },
    }),
    db.enrollment.groupBy({
      by: ['currency'],
      where: {
        createdAt: where.createdAt,
        ...(cohortId ? { cohortId } : {}),
        status: 'PENDING',
        agreedAt: { not: null },
        amountMinor: { not: null },
        reservedUntil: { gt: new Date() },
      },
      _sum: { amountMinor: true },
    }),
    db.refundRequest.findMany({
      where: {
        createdAt: where.createdAt,
        ...(cohortId
          ? {
              paymentId: {
                in: (
                  await db.payment.findMany({
                    where: { enrollment: { cohortId } },
                    select: { id: true },
                  })
                ).map((p) => p.id),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.payment.count({ where: { ...where, status: 'FAILED' } }),
  ]);
  return { cash, obligations, refunds, failed, from, to, cohortId };
}
export function period(q: Record<string, string | undefined>) {
  const to = q.to ? new Date(q.to) : new Date(),
    from = q.from ? new Date(q.from) : new Date(+to - 30 * 86400000);
  ensure(
    Number.isFinite(+from) &&
      Number.isFinite(+to) &&
      to > from &&
      +to - +from <= 366 * 86400000,
    422,
    'PERIOD',
    'Choose a period of up to 366 days.',
  );
  return { from, to, cohort: q.cohort ?? '' };
}
