import 'server-only';
import type { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getDb } from './db';
import { env, authConfigured } from './env';
import { canAccess, type Role } from './roles';
import { logEvent } from './logger';
export const authOptions: NextAuthOptions = {
  ...(authConfigured ? { adapter: PrismaAdapter(getDb()) } : {}),
  secret: env.NEXTAUTH_SECRET,
  providers:
    authConfigured && env.GITHUB_ID && env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: env.GITHUB_ID!,
            clientSecret: env.GITHUB_SECRET!,
          }),
        ]
      : [],
  session: { strategy: 'database', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/sign-in', error: '/sign-in' },
  callbacks: {
    session: async ({ session, user }) => {
      // Reload authorization from the database; never accept a client-selected role.
      const record = await getDb().user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          disabledAt: true,
          forceChange: true,
          staffScope: true,
        },
      });
      if (!record || record.disabledAt)
        throw new Error('Session account is no longer available');
      session.user.id = user.id;
      session.user.forceChange = record.forceChange;
      session.user.staffScope = record.staffScope;
      session.user.role = record.role;
      return session;
    },
  },
  logger: {
    error: (code) => logEvent('auth_error', code),
    warn: (code) => logEvent('auth_warning', code),
    debug: () => {},
  },
};
export async function requireRole(allowed: readonly Role[]) {
  if (!authConfigured) redirect('/sign-in?reason=configuration');
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.forceChange) redirect('/account/change-password');
  if (session.user.staffScope && session.user.staffScope !== 'SUPER_ADMIN')
    redirect('/operations');
  if (!canAccess(session.user.role, allowed)) {
    logEvent('access_denied');
    redirect('/forbidden');
  }
  return session;
}
