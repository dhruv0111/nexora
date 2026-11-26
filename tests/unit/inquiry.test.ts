import { describe, expect, it } from 'vitest';
import { inquirySchema } from '@/lib/inquiry-validation';
import {
  createChallenge,
  verifyChallenge,
  sameOrigin,
  CHALLENGE_MIN_AGE,
  CHALLENGE_MAX_AGE,
} from '@/lib/inquiry-policy';
const secret = 'unit-test-signing-secret-000000000000';
const valid = {
  name: 'A Learner',
  email: 'LEARNER@example.test',
  program: 'qa-sdet',
  intent: 'program_interest',
  message: '',
  consent: true,
  website: '',
};
describe('inquiry boundary', () => {
  it('normalizes contact details and accepts explicit consent', () =>
    expect(inquirySchema.parse(valid).email).toBe('learner@example.test'));
  it.each([
    { consent: false },
    { email: 'invalid' },
    { name: 'x' },
    { program: 'admin' },
    { intent: 'guaranteed_job' },
    { website: 'spam.example' },
    { message: 'a'.repeat(1001) },
  ])('rejects invalid or automated input: %o', (patch) =>
    expect(inquirySchema.safeParse({ ...valid, ...patch }).success).toBe(false),
  );
  it('accepts a valid aged challenge', () => {
    const token = createChallenge(secret, 1000);
    expect(
      verifyChallenge(secret, token, 1000 + CHALLENGE_MIN_AGE + 1),
    ).toHaveProperty('nonce');
  });
  it('rejects premature, expired, future and tampered challenges', () => {
    const token = createChallenge(secret, 1000);
    expect(verifyChallenge(secret, token, 1001)).toBeNull();
    expect(
      verifyChallenge(secret, token, 1000 + CHALLENGE_MAX_AGE + 1),
    ).toBeNull();
    expect(verifyChallenge(secret, token, 0)).toBeNull();
    expect(verifyChallenge(secret, token + 'x', 5000)).toBeNull();
    expect(verifyChallenge('other', token, 5000)).toBeNull();
    expect(verifyChallenge(secret, 'a'.repeat(10000))).toBeNull();
  });
  it('uses the configured public origin behind an internal Next.js URL', () => {
    expect(
      sameOrigin(
        new Request('http://localhost:3100/api/inquiries', {
          headers: { origin: 'https://nexora.example' },
        }),
        'https://nexora.example',
      ),
    ).toBe(true);
  });
  it('rejects cross-origin and missing-origin submissions', () => {
    expect(
      sameOrigin(
        new Request('https://nexora.example/api/inquiries', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(new Request('https://nexora.example/api/inquiries')),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request('https://nexora.example/api/inquiries', {
          headers: { origin: 'https://nexora.example' },
        }),
      ),
    ).toBe(true);
  });
});
