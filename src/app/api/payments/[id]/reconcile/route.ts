import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { reconcilePayment } from '@/lib/payments/enrollment';
import { getDb } from '@/lib/db';
import { ensure } from '@/lib/domain/errors';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['STUDENT', 'ADMIN']);
    await readJson(request);
    await limited(who.id, 'reconcile', 10);
    const id = (await params).id;
    const p = await getDb().payment.findFirst({
      where: {
        id,
        ...(who.role === 'ADMIN' ? {} : { enrollment: { userId: who.id } }),
      },
    });
    ensure(p, 404, 'PAYMENT', 'Payment not found.');
    return reconcilePayment(id, who.id);
  });
}
