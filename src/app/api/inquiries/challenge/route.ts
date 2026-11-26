import { env } from '@/lib/env';
import { createChallenge } from '@/lib/inquiry-policy';
export const dynamic = 'force-dynamic';
export function GET() {
  if (!env.DATABASE_URL || !env.LEAD_FORM_SECRET)
    return Response.json(
      { error: 'Inquiries are currently unavailable. Please try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  return Response.json(
    { token: createChallenge(env.LEAD_FORM_SECRET) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
