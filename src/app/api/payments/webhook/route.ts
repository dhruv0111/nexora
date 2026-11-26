import { endpoint, readRaw } from '@/lib/domain/http';
import { handleWebhook } from '@/lib/payments/webhooks';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return endpoint(async () =>
    handleWebhook(
      await readRaw(request),
      request.headers.get('x-razorpay-signature') ?? '',
      request.headers.get('x-razorpay-event-id') ?? '',
    ),
  );
}
