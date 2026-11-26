import { env } from '@/lib/env';
import { inquirySchema } from '@/lib/inquiry-validation';
import { verifyChallenge, sameOrigin } from '@/lib/inquiry-policy';
import {
  saveInquiry,
  InquiryConflictError,
  InquiryLimitError,
} from '@/lib/inquiries';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!sameOrigin(request, env.INQUIRY_ORIGIN ?? env.NEXTAUTH_URL))
    return reply(
      { error: 'Please submit the form from the Nexora website.' },
      403,
    );
  if (!env.DATABASE_URL || !env.LEAD_FORM_SECRET)
    return reply(
      { error: 'Inquiries are currently unavailable. Please try again later.' },
      503,
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'Unsupported request format.' }, 415);
  // Stream with a hard cap; do not buffer an unbounded or spoofed Content-Length request.
  let raw = '';
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Request body is required.' }, 400);
  const decoder = new TextDecoder();
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      return reply({ error: 'The request is too large.' }, 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ error: 'Invalid request.' }, 400);
  }
  if (typeof body !== 'object' || body === null)
    return reply({ error: 'Invalid request.' }, 400);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success)
    return reply(
      {
        error: 'Check the highlighted fields and try again.',
        fields: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  const token =
    'token' in body && typeof body.token === 'string' ? body.token : '';
  const challenge = verifyChallenge(env.LEAD_FORM_SECRET, token);
  if (!challenge)
    return reply(
      {
        error:
          'Your form check expired or was submitted too quickly. Please retry.',
      },
      400,
    );
  try {
    const ip =
      env.INQUIRY_TRUST_PROXY === 'true'
        ? (request.headers
            .get('x-forwarded-for')
            ?.split(',')[0]
            ?.trim()
            .slice(0, 64) ?? null)
        : null;
    const receipt = await saveInquiry(
      parsed.data,
      challenge.nonce,
      env.LEAD_FORM_SECRET,
      ip,
    );
    return reply({ receipt }, 201);
  } catch (error) {
    if (error instanceof InquiryLimitError)
      return Response.json(
        {
          error:
            'Too many requests. Please wait ten minutes before trying again.',
        },
        {
          status: 429,
          headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' },
        },
      );
    if (error instanceof InquiryConflictError)
      return reply(
        {
          error:
            'This form was already submitted. Reload to start a new request.',
        },
        409,
      );
    console.error(JSON.stringify({ event: 'inquiry_unavailable' }));
    return reply(
      {
        error:
          'We could not save your inquiry. Your details are still in the form. Please retry.',
      },
      503,
    );
  }
}
