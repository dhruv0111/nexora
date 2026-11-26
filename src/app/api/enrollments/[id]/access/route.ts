import { actor, endpoint } from '@/lib/domain/http';
import { paidAccess } from '@/lib/payments/enrollment';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const who = await actor(['STUDENT']);
    return paidAccess(who.id, (await params).id);
  });
}
