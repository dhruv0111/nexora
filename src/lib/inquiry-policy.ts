import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const CHALLENGE_MIN_AGE = 1500;
export const CHALLENGE_MAX_AGE = 60 * 60 * 1000;
export function hashInquiryValue(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}
export function createChallenge(secret: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ nonce: randomBytes(24).toString('hex'), issuedAt: now }),
  ).toString('base64url');
  return `${payload}.${hashInquiryValue(secret, payload)}`;
}
export function verifyChallenge(
  secret: string,
  token: string,
  now = Date.now(),
): { nonce: string; issuedAt: number } | null {
  try {
    if (token.length > 512) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = hashInquiryValue(secret, payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null;
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    );
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('nonce' in decoded) ||
      !('issuedAt' in decoded)
    )
      return null;
    const { nonce, issuedAt } = decoded;
    if (
      typeof nonce !== 'string' ||
      !/^[a-f0-9]{48}$/.test(nonce) ||
      typeof issuedAt !== 'number' ||
      !Number.isSafeInteger(issuedAt)
    )
      return null;
    if (
      now - issuedAt < CHALLENGE_MIN_AGE ||
      now - issuedAt > CHALLENGE_MAX_AGE
    )
      return null;
    return { nonce, issuedAt };
  } catch {
    return null;
  }
}
export function sameOrigin(request: Request, canonicalOrigin?: string) {
  const origin = request.headers.get('origin');
  return (
    origin !== null && origin === new URL(canonicalOrigin ?? request.url).origin
  );
}
