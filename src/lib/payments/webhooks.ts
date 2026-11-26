import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { DomainError, ensure } from '@/lib/domain/errors';
import { gateway, type Gateway } from './gateway';
import { sha256, verifyHmac } from './security';
import { applyProviderState } from './enrollment';
const entity = z.object({
  id: z.string().max(100).optional(),
  order_id: z.string().max(100).nullable().optional(),
  payment_id: z.string().max(100).optional(),
});
const payloadSchema = z.object({
  event: z.string().max(80),
  payload: z.object({
    payment: z.object({ entity }).optional(),
    order: z.object({ entity }).optional(),
    refund: z.object({ entity }).optional(),
  }),
});
export async function handleWebhook(
  raw: Buffer,
  signature: string,
  eventId: string,
  api: Gateway = gateway,
) {
  ensure(
    api.ready(),
    503,
    'PAYMENTS_DISABLED',
    'Sandbox webhooks are not configured.',
  );
  ensure(
    verifyHmac(raw, signature, api.webhookSecret()),
    400,
    'WEBHOOK_SIGNATURE',
    'Webhook signature was invalid.',
  );
  ensure(
    /^[a-zA-Z0-9_-]{1,120}$/.test(eventId),
    400,
    'EVENT_ID',
    'A valid provider event identifier is required.',
  );
  const body = payloadSchema.parse(JSON.parse(raw.toString('utf8')));
  const hash = sha256(raw);
  const db = getDb();
  let event = await db.paymentEvent.findUnique({
    where: { providerEventId: eventId },
  });
  if (event) {
    ensure(
      event.payloadHash === hash,
      409,
      'EVENT_COLLISION',
      'The provider event identifier was reused with different content.',
    );
    if (['PROCESSED', 'IGNORED'].includes(event.state))
      return { received: true, duplicate: true };
  } else {
    try {
      event = await db.paymentEvent.create({
        data: {
          providerEventId: eventId,
          eventType: body.event,
          payloadHash: hash,
          providerOrderId:
            body.payload.order?.entity.id ??
            body.payload.payment?.entity.order_id ??
            null,
          providerPaymentId:
            body.payload.payment?.entity.id ??
            body.payload.refund?.entity.payment_id ??
            null,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        event = await db.paymentEvent.findUniqueOrThrow({
          where: { providerEventId: eventId },
        });
        ensure(
          event.payloadHash === hash,
          409,
          'EVENT_COLLISION',
          'Event identity mismatch.',
        );
      } else throw error;
    }
  }
  const id = event.id;
  if (
    ![
      'payment.captured',
      'payment.failed',
      'order.paid',
      'refund.processed',
    ].includes(body.event)
  ) {
    await db.paymentEvent.update({
      where: { id },
      data: {
        state: 'IGNORED',
        reason: 'UNSUPPORTED_EVENT',
        processedAt: new Date(),
      },
    });
    return { received: true, ignored: true };
  }
  await db.paymentEvent.update({
    where: { id },
    data: { attempts: { increment: 1 }, state: 'RECEIVED' },
  });
  try {
    let orderId =
      body.payload.order?.entity.id ?? body.payload.payment?.entity.order_id;
    const paymentId =
      body.payload.payment?.entity.id ?? body.payload.refund?.entity.payment_id;
    const payment = paymentId ? await api.getPayment(paymentId) : null;
    orderId = orderId ?? payment?.order_id;
    ensure(
      orderId && /^order_[a-zA-Z0-9]+$/.test(orderId),
      422,
      'ORDER_ID',
      'The event requires a valid payment order.',
    );
    const order = await api.getOrder(orderId);
    const attempts = payment ? [] : await api.orderPayments(orderId);
    const resolved =
      payment ??
      attempts.find(
        (p) => p.status === 'captured' || p.status === 'refunded',
      ) ??
      attempts.at(-1);
    ensure(
      resolved,
      409,
      'PAYMENT_PENDING',
      'The provider has not returned a payment yet.',
    );
    const result = await applyProviderState(order, resolved, null, api);
    const stored = await db.payment.findUnique({
      where: { providerOrderId: order.id },
      select: { id: true },
    });
    await db.paymentEvent.update({
      where: { id },
      data: {
        paymentId: stored?.id,
        providerOrderId: order.id,
        providerPaymentId: resolved.id,
        state: 'PROCESSED',
        reason: null,
        processedAt: new Date(),
      },
    });
    return { received: true, ...result };
  } catch (error) {
    const unknown =
      error instanceof DomainError && error.code === 'UNKNOWN_ORDER';
    await db.paymentEvent.update({
      where: { id },
      data: {
        state: unknown ? 'IGNORED' : 'FAILED',
        reason:
          error instanceof DomainError ? error.code : 'RECONCILIATION_REQUIRED',
        ...(unknown ? { processedAt: new Date() } : {}),
      },
    });
    if (unknown) return { received: true, ignored: true };
    throw error;
  }
}
