import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { authConfigured, env } from '@/lib/env';
import { sameOrigin, hashInquiryValue } from '@/lib/inquiry-policy';
import type { Role } from '@/lib/roles';
import { getDb } from '@/lib/db';
import { DomainError, ensure } from './errors';
import { ZodError } from 'zod';
export type Actor = { id: string; role: Role };
export async function actor(allowed: readonly Role[]): Promise<Actor> {
  ensure(authConfigured, 503, 'AUTH_DISABLED', 'Sign-in is not configured.');
  const session = await getServerSession(authOptions);
  ensure(session?.user, 401, 'SIGN_IN', 'Sign in to continue.');
  ensure(
    !session.user.forceChange &&
      (!session.user.staffScope || session.user.staffScope === 'SUPER_ADMIN'),
    403,
    'SCOPE',
    'Use your authorized operations workspace.',
  );
  ensure(
    allowed.includes(session.user.role),
    403,
    'FORBIDDEN',
    'This action requires a different role.',
  );
  return { id: session.user.id, role: session.user.role };
}
export async function limited(actorId: string, action: string, max = 30) {
  const now = Date.now(),
    window = Math.floor(now / 60000);
  const key = hashInquiryValue(
    env.NEXTAUTH_SECRET!,
    `${action}:${actorId}:${window}`,
  );
  const row = await getDb().actionRateBucket.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date((window + 1) * 60000) },
    update: { count: { increment: 1 } },
  });
  ensure(
    row.count <= max,
    429,
    'RATE_LIMIT',
    'Too many requests. Please wait a minute.',
  );
  await getDb().actionRateBucket.deleteMany({
    where: { expiresAt: { lt: new Date(now) } },
  });
}
export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function readJson(request: Request, maxBytes = 65536) {
  ensure(
    sameOrigin(request, env.INQUIRY_ORIGIN ?? env.NEXTAUTH_URL),
    403,
    'ORIGIN',
    'Submit this action from the Nexora website.',
  );
  ensure(
    request.headers.get('content-type')?.startsWith('application/json'),
    415,
    'MEDIA_TYPE',
    'Use JSON for this request.',
  );
  return JSON.parse(
    (await readRaw(request, maxBytes)).toString('utf8'),
  ) as unknown;
}
export async function readRaw(request: Request, maxBytes = 262144) {
  const reader = request.body?.getReader();
  ensure(reader, 400, 'BODY', 'Request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new DomainError(413, 'BODY_LIMIT', 'Request is too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function endpoint(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    if (error instanceof DomainError)
      return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error: 'Check the fields and try again.',
          fields: error.flatten().fieldErrors,
        },
        422,
      );
    if (error instanceof SyntaxError)
      return json({ error: 'Invalid JSON.' }, 400);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
      return json(
        {
          error:
            'This record already exists. Refresh to view its current state.',
          code: 'DUPLICATE',
        },
        409,
      );
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^(P[0-9]{4}|[0-9A-Z]{5})$/.test(error.code)
        ? error.code
        : 'UNCLASSIFIED';
    console.error(JSON.stringify({ event: 'domain_request_failed', code }));
    return json(
      {
        error:
          'This action is temporarily unavailable. Your existing records have not been discarded.',
      },
      503,
    );
  }
}
