import { actor, endpoint, readJson, limited } from '@/lib/domain/http';
import { startCheckout } from '@/lib/payments/enrollment';
export async function POST(request: Request) {
  return endpoint(async () => {
    const who = await actor(['STUDENT']);
    const data = await readJson(request);
    await limited(who.id, 'checkout', 8);
    return startCheckout(who.id, data);
  });
}
