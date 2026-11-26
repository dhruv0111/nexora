import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
export function verifyHmac(
  value: string | Buffer,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac('sha256', secret).update(value).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}
export function verifyCheckoutSignature(
  serverOrderId: string,
  paymentId: string,
  signature: string,
  secret: string,
) {
  return verifyHmac(`${serverOrderId}|${paymentId}`, signature, secret);
}
