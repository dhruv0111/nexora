export const roles = ['STUDENT', 'MENTOR', 'EMPLOYER', 'ADMIN'] as const;
export type Role = (typeof roles)[number];
export type Audience = Role | 'VISITOR';
export function canAccess(
  actual: string | undefined,
  allowed: readonly Role[],
) {
  return actual !== undefined && allowed.some((role) => role === actual);
}
export function dashboardPath(role: Role) {
  return `/dashboard/${role.toLowerCase()}`;
}
