import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  find: vi.fn(),
  configured: { value: true },
}));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@/lib/env', () => ({
  get authConfigured() {
    return mocks.configured.value;
  },
  env: {
    NEXTAUTH_SECRET: 'a'.repeat(32),
    GITHUB_ID: 'id',
    GITHUB_SECRET: 'secret',
  },
}));
vi.mock('@/lib/db', () => ({
  getDb: () => ({ user: { findUnique: mocks.find } }),
}));
vi.mock('@/lib/logger', () => ({ logEvent: vi.fn() }));
import { authOptions, requireRole } from '@/lib/auth';
describe('server authentication boundary', () => {
  beforeEach(() => {
    mocks.configured.value = true;
    mocks.session.mockReset();
    mocks.find.mockReset();
  });
  it('blocks anonymous access', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(requireRole(['ADMIN'])).rejects.toThrow('REDIRECT:/sign-in');
  });
  it('blocks student access to admin', async () => {
    mocks.session.mockResolvedValue({
      user: { id: 'student', role: 'STUDENT' },
    });
    await expect(requireRole(['ADMIN'])).rejects.toThrow('REDIRECT:/forbidden');
  });
  it('permits an authorized server session', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'mentor', role: 'MENTOR' } });
    await expect(requireRole(['MENTOR'])).resolves.toMatchObject({
      user: { id: 'mentor' },
    });
  });
  it('fails closed when integrations are absent', async () => {
    mocks.configured.value = false;
    await expect(requireRole(['STUDENT'])).rejects.toThrow(
      'reason=configuration',
    );
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it('reloads the role from storage instead of trusting session input', async () => {
    mocks.find.mockResolvedValue({ role: 'STUDENT' });
    const callback = authOptions.callbacks!.session!;
    const input = {
      session: { user: { role: 'ADMIN' }, expires: '' },
      user: { id: 'u1' },
    } as unknown as Parameters<typeof callback>[0];
    const result = await callback(input);
    expect(result).toMatchObject({ user: { role: 'STUDENT' } });
    expect(mocks.find).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: {
        role: true,
        disabledAt: true,
        forceChange: true,
        staffScope: true,
      },
    });
  });
});
