import 'server-only';
import { z } from 'zod';
import { env } from '@/lib/env';
import { DomainError, ensure } from '@/lib/domain/errors';
export const orderSchema = z.object({
  id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
  amount: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  receipt: z
    .string()
    .max(40)
    .nullish()
    .transform((value) => value ?? ''),
  status: z.enum(['created', 'attempted', 'paid']),
  amount_paid: z.number().int().nonnegative(),
});
export const paymentSchema = z.object({
  id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
  order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
  amount: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(['created', 'authorized', 'captured', 'refunded', 'failed']),
  amount_refunded: z.number().int().nonnegative().default(0),
});
export type ProviderOrder = z.infer<typeof orderSchema>;
export type ProviderPayment = z.infer<typeof paymentSchema>;
export interface Gateway {
  ready(): boolean;
  publicKey(): string;
  signingSecret(): string;
  webhookSecret(): string;
  createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
  }): Promise<ProviderOrder>;
  getOrder(id: string): Promise<ProviderOrder>;
  getPayment(id: string): Promise<ProviderPayment>;
  findOrder(receipt: string): Promise<ProviderOrder | null>;
  orderPayments(id: string): Promise<ProviderPayment[]>;
}
export const sandboxReady = Boolean(
  env.RAZORPAY_MODE === 'test' &&
  env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') &&
  env.RAZORPAY_KEY_SECRET &&
  env.RAZORPAY_WEBHOOK_SECRET,
);
async function request(path: string, body?: object): Promise<unknown> {
  ensure(
    sandboxReady,
    503,
    'PAYMENTS_DISABLED',
    'Sandbox checkout is not configured. No payment has been taken.',
  );
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
  } catch {
    throw new DomainError(
      502,
      'GATEWAY_UNCERTAIN',
      'The payment provider could not be reached. Reconcile the existing order before retrying.',
    );
  }
  if (!response.ok)
    throw new DomainError(
      502,
      'GATEWAY_UNCERTAIN',
      'The provider could not confirm this operation. Reconciliation is required before another order can be attempted.',
    );
  return response.json();
}
export const gateway: Gateway = {
  ready: () => sandboxReady,
  publicKey: () => env.RAZORPAY_KEY_ID ?? '',
  signingSecret: () => env.RAZORPAY_KEY_SECRET ?? '',
  webhookSecret: () => env.RAZORPAY_WEBHOOK_SECRET ?? '',
  createOrder: async (input) =>
    orderSchema.parse(
      await request('orders', { ...input, partial_payment: false }),
    ),
  getOrder: async (id) =>
    orderSchema.parse(await request(`orders/${encodeURIComponent(id)}`)),
  getPayment: async (id) =>
    paymentSchema.parse(await request(`payments/${encodeURIComponent(id)}`)),
  findOrder: async (receipt) => {
    const result = z
      .object({ items: z.array(orderSchema) })
      .parse(
        await request(`orders?receipt=${encodeURIComponent(receipt)}&count=2`),
      );
    ensure(
      result.items.length <= 1,
      409,
      'ORDER_AMBIGUOUS',
      'Multiple matching provider orders require manual reconciliation.',
    );
    return result.items[0] ?? null;
  },
  orderPayments: async (id) =>
    z
      .object({ items: z.array(paymentSchema).max(100) })
      .parse(
        await request(`orders/${encodeURIComponent(id)}/payments?count=100`),
      ).items,
};
