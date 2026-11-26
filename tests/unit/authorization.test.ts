import { describe, expect, it } from 'vitest';
import { canAccess, dashboardPath, roles } from '@/lib/roles';
describe('role policy', () => {
  it.each(roles)('permits only the exact %s role', (role) => {
    for (const actual of roles)
      expect(canAccess(actual, [role])).toBe(actual === role);
  });
  it('denies anonymous and unrecognized roles', () => {
    expect(canAccess(undefined, roles)).toBe(false);
    expect(canAccess('VISITOR', roles)).toBe(false);
    expect(canAccess('admin', roles)).toBe(false);
  });
  it('maps each role to its workspace', () =>
    expect(dashboardPath('MENTOR')).toBe('/dashboard/mentor'));
});
