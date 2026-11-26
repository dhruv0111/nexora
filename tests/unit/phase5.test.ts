import { describe, it, expect } from 'vitest';
import { allowedTransition } from '@/lib/projects/policy';
import { githubLink } from '@/lib/projects/github';
import { verifyHmac } from '@/lib/payments/security';
import { createHmac } from 'node:crypto';
describe('delivery and integration boundaries', () => {
  it('allows student development/review moves but reserves quality completion for leads', () => {
    expect(allowedTransition('READY', 'IN_PROGRESS', true)).toBe(true);
    expect(allowedTransition('IN_PROGRESS', 'IN_REVIEW', true)).toBe(true);
    expect(allowedTransition('QA_TESTING', 'DONE', true)).toBe(false);
    expect(allowedTransition('QA_TESTING', 'DONE', false)).toBe(true);
    expect(allowedTransition('BACKLOG', 'DONE', false)).toBe(false);
  });
  it('parses only exact GitHub resource URLs and full commit SHAs', () => {
    expect(githubLink('https://github.com/org/repo/pull/12')).toMatchObject({
      repository: 'org/repo',
      kind: 'pull',
      reference: '12',
    });
    expect(
      githubLink('https://github.com/org/repo/commit/' + 'a'.repeat(40)).kind,
    ).toBe('commit');
    for (const u of [
      'https://github.com.evil.test/org/repo/pull/12',
      'https://github.com/org/repo/commit/abc',
      'https://github.com/org/repo/pull/2?x=y',
    ])
      expect(() => githubLink(u)).toThrow();
  });
  it('verifies exact raw bytes with constant-time HMAC comparison', () => {
    const raw = Buffer.from('{"action":"opened"}'),
      secret = 'isolated-project-secret',
      signature = createHmac('sha256', secret).update(raw).digest('hex');
    expect(verifyHmac(raw, signature, secret)).toBe(true);
    expect(
      verifyHmac(Buffer.concat([raw, Buffer.from(' ')]), signature, secret),
    ).toBe(false);
  });
});
