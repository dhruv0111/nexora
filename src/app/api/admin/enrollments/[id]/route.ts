import { z } from 'zod';
import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { serial, lock, audit } from '@/lib/domain/transaction';
import { ensure } from '@/lib/domain/errors';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['ADMIN']);
    z.object({ action: z.literal('cancel-pending') })
      .strict()
      .parse(await readJson(request));
    await limited(who.id, 'enrollment-admin');
    return serial(async (tx) => {
      const id = (await params).id;
      const e = await tx.enrollment.findUnique({
        where: { id },
        include: { payments: true },
      });
      ensure(e, 404, 'ENROLLMENT', 'Enrollment not found.');
      await lock(tx, `enrollment:${e.applicationId ?? e.id}`);
      ensure(
        e.status === 'PENDING' && e.payments.length === 0,
        409,
        'PAYMENT_REVIEW',
        'An enrollment with payment attempts requires provider reconciliation, not manual cancellation.',
      );
      await tx.enrollment.update({
        where: { id },
        data: { status: 'CANCELLED', reservedUntil: null },
      });
      await audit(tx, who.id, 'PENDING_ENROLLMENT_CANCELLED', 'Enrollment', id);
      return { id, status: 'CANCELLED' };
    });
  });
}
