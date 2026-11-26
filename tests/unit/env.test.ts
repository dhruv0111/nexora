import { describe, expect, it } from 'vitest';
import { readEnv } from '@/lib/env';
describe('environment validation', () => {
  it('permits a public shell without secret integrations', () =>
    expect(readEnv({}).GITHUB_ID).toBeUndefined());
  it('rejects partial OAuth configuration', () =>
    expect(() => readEnv({ GITHUB_ID: 'id' })).toThrow('Invalid environment'));
  it('rejects weak secrets and invalid connection URLs', () => {
    expect(() => readEnv({ NEXTAUTH_SECRET: 'short' })).toThrow();
    expect(() => readEnv({ DATABASE_URL: 'invalid' })).toThrow();
  });
  it('never includes a rejected secret in its error', () => {
    try {
      readEnv({ NEXTAUTH_SECRET: 'private-value' });
    } catch (error) {
      expect(String(error)).not.toContain('private-value');
    }
  });
});
