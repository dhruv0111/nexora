import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { verifyPayment } from '@/lib/payments/enrollment';
export async function POST(request: Request) {
  return endpoint(async () => {
    const who = await actor(['STUDENT']);
    const data = await readJson(request);
    await limited(who.id, 'verify', 20);
    return verifyPayment(who.id, data);
  });
}
