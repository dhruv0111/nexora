import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { verifyHmac, verifyCheckoutSignature } from '@/lib/payments/security';
import { safeReturnPath } from '@/lib/redirects';
import {
  applicantSchema,
  draftSchema,
  transitions,
} from '@/lib/admissions/validation';
import { checkoutSchema } from '@/lib/payments/enrollment';
import { readEnv } from '@/lib/env';
const secret = 'unit-test-secret';
describe('payment and admissions security primitives', () => {
  it('uses the server order identity for the checkout signature', () => {
    const signature = createHmac('sha256', secret)
      .update('order_trusted|pay_valid')
      .digest('hex');
    expect(
      verifyCheckoutSignature('order_trusted', 'pay_valid', signature, secret),
    ).toBe(true);
    expect(
      verifyCheckoutSignature('order_attacker', 'pay_valid', signature, secret),
    ).toBe(false);
  });
  it('requires the exact raw webhook bytes', () => {
    const raw = Buffer.from('{"event":"payment.captured"}'),
      signature = createHmac('sha256', secret).update(raw).digest('hex');
    expect(verifyHmac(raw, signature, secret)).toBe(true);
    expect(
      verifyHmac(Buffer.concat([raw, Buffer.from('\n')]), signature, secret),
    ).toBe(false);
    expect(verifyHmac(raw, 'not-hex', secret)).toBe(false);
  });
  it.each([
    'https://attacker.example',
    '//attacker.example',
    '/\\evil',
    '/apply/test?redirect=https://evil',
    '%2f%2fevil',
  ])('rejects unsafe return path %s', (path) =>
    expect(safeReturnPath(path)).toBe('/dashboard'),
  );
  it('allows a bounded internal application path', () =>
    expect(safeReturnPath('/apply/ai-engineering')).toBe(
      '/apply/ai-engineering',
    ));
  it('accepts incomplete saved drafts but rejects incomplete submissions', () => {
    expect(
      draftSchema.safeParse({
        action: 'save',
        version: 0,
        details: { fullName: '' },
      }).success,
    ).toBe(true);
    expect(applicantSchema.safeParse({ fullName: 'Test' }).success).toBe(false);
    expect(transitions.SUBMITTED).not.toContain('ACCEPTED');
  });
  it('rejects client prices and missing agreement', () => {
    const q = {
      applicationId: 'app',
      cohortId: 'cohort',
      priceVersion: 1,
      termsVersion: 'v1',
      agree: true,
    };
    expect(checkoutSchema.safeParse(q).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...q, amount: 1 }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...q, agree: false }).success).toBe(
      false,
    );
  });
  it('does not accept live keys or partially configured sandbox mode', () => {
    expect(() => readEnv({ RAZORPAY_KEY_ID: 'rzp_live_do_not_use' })).toThrow();
    expect(() => readEnv({ RAZORPAY_MODE: 'test' })).toThrow();
    expect(readEnv({}).RAZORPAY_MODE).toBe('disabled');
  });
});
